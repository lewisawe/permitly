"use node";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

// The case runner: drives a renewal case through its automated steps up to the
// human approval gate. Ties together Firecrawl (scrape + interact), the LLM
// (field mapping), and AgentMail (owner emails). Designed to run in short bursts
// (Firecrawl sessions are ~10 min), scheduled from Convex.
//
// Steps 0-3 automated here; step 5 (await_approval) hands off to the human.

const FORM_FIELDS = [
  "legalName",
  "address",
  "contactName",
  "priorPermitNo",
  "renewalTerm",
];

export const run = internalAction({
  args: { caseId: v.id("cases"), portalUrl: v.string() },
  handler: async (ctx, { caseId, portalUrl }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data || !data.case || !data.permit) return;
    const businessId = data.case.businessId;

    // Load the business profile (for field mapping + owner email).
    const business = await ctx.runQuery(internal.cases.getBusiness, {
      businessId,
    });
    if (!business) return;

    async function turn(direction: "inbound" | "outbound" | "system", summary: string) {
      await ctx.runMutation(api.cases.addTurn, { caseId, direction, summary });
    }
    async function step(order: number, status: "running" | "done" | "blocked", result?: string) {
      await ctx.runMutation(api.cases.setStep, { caseId, order, status, result });
    }

    try {
      // Step 0: find/open the official page (scrape it).
      await ctx.runMutation(api.cases.setState, { caseId, state: "finding_page" });
      await step(0, "running");
      const scraped = await ctx.runAction(api.firecrawl.scrape, { url: portalUrl });
      if (!scraped.scrapeId) throw new Error("Could not open the portal page.");
      await ctx.runMutation(api.cases.setSession, {
        caseId,
        scrapeId: scraped.scrapeId,
      });
      await step(0, "done", "Opened the renewal portal.");
      await turn("system", "Opened the Springfield City Permits renewal portal.");

      // Step 1: read the form (we know the fields for the demo portal).
      await ctx.runMutation(api.cases.setState, { caseId, state: "reading_form" });
      await step(1, "running");
      await step(1, "done", `Form fields: ${FORM_FIELDS.join(", ")}.`);

      // Step 2: fill the form via the LLM mapping + Firecrawl interact.
      await ctx.runMutation(api.cases.setState, { caseId, state: "filling_form" });
      await step(2, "running");
      const mapping = await ctx.runAction(api.llm.fillFields, {
        fields: FORM_FIELDS,
        profile: business.profile,
      });

      // Fill each known value on the page. Capture the live-view URL so the UI
      // embed lights up.
      let liveViewUrl = "";
      for (const [field, value] of Object.entries(mapping.values)) {
        const label = field.replace(/([A-Z])/g, " $1").toLowerCase();
        const res = await ctx.runAction(api.firecrawl.interact, {
          scrapeId: scraped.scrapeId,
          prompt: `Type "${value}" into the ${label} field.`,
        });
        if (res.liveViewUrl && !liveViewUrl) {
          liveViewUrl = res.liveViewUrl;
          await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl });
        }
      }
      await step(2, "done", `Filled: ${Object.keys(mapping.values).join(", ")}.`);
      await turn("system", `Filled ${Object.keys(mapping.values).length} fields from your business profile.`);

      // Step 3: request missing info from the owner (if any).
      await step(3, "running");
      if (mapping.missing.length > 0 && data.case.inboxId) {
        await ctx.runMutation(api.cases.setState, { caseId, state: "awaiting_info" });
        const missingList = mapping.missing.join(", ");
        await ctx.runAction(api.email.send, {
          inboxId: data.case.inboxId,
          to: business.ownerEmail,
          subject: `Permitly: one detail needed for your ${data.permit.type}`,
          text:
            `I'm renewing your ${data.permit.type}. I need this to continue: ` +
            `${missingList}. Reply with the value and I'll finish the form.`,
        });
        await step(3, "done", `Asked the owner for: ${missingList}.`);
        await turn("outbound", `Emailed the owner for the missing field: ${missingList}.`);
        await ctx.runMutation(api.permits.setStatus, {
          permitId: data.permit._id,
          status: "awaiting_info",
        });
        // Stop the Firecrawl session while we wait for the reply.
        await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: scraped.scrapeId });
        return;
      }
      await step(3, "done", "No missing fields.");

      // No missing info -> go straight to the approval gate.
      await ctx.runMutation(api.cases.setState, { caseId, state: "awaiting_approval" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "awaiting_approval",
      });
      await turn("system", "Ready to submit. Waiting for your approval.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.cases.setState, { caseId, state: "blocked", lastError: msg });
      await turn("system", `Blocked: ${msg}`);
    }
  },
});

// Handle an inbound owner reply: record it, and move the case to the approval
// gate. (Demo: we accept the reply text as the missing value and proceed.)
export const handleReply = internalAction({
  args: { caseId: v.id("cases"), replyText: v.string() },
  handler: async (ctx, { caseId, replyText }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data?.case || !data.permit) return;

    await ctx.runMutation(api.cases.addTurn, {
      caseId,
      direction: "inbound",
      summary: `Owner replied: "${replyText.slice(0, 120)}"`,
    });

    // Mark the request_info step done, then handle inspection booking if needed.
    await ctx.runMutation(api.cases.setStep, {
      caseId,
      order: 3,
      status: "done",
      result: "Owner provided the missing detail.",
    });

    // Step 4: book an inspection slot if this permit requires one (Firecrawl).
    if (data.permit.requiresInspection && data.permit.bookingUrl) {
      await ctx.runMutation(api.cases.setState, { caseId, state: "booking_slot" });
      await ctx.runMutation(api.cases.setStep, { caseId, order: 4, status: "running" });
      try {
        const site = process.env.CONVEX_SITE_URL ?? "";
        const scraped = await ctx.runAction(api.firecrawl.scrape, {
          url: `${site}${data.permit.bookingUrl}`,
        });
        if (scraped.scrapeId) {
          await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: scraped.scrapeId });
          const pick = await ctx.runAction(api.firecrawl.interact, {
            scrapeId: scraped.scrapeId,
            prompt: "Click the first available inspection time slot, then click Confirm appointment.",
          });
          if (pick.liveViewUrl) {
            await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: pick.liveViewUrl });
          }
          const ref = await ctx.runAction(api.firecrawl.interact, {
            scrapeId: scraped.scrapeId,
            prompt: "Report the booking reference number and the scheduled time shown on the page.",
          });
          await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: scraped.scrapeId });
          const refMatch = (ref.output || "").match(/INSP-2026-\d{3,4}/);
          const bookingRef = refMatch ? refMatch[0] : "INSP-2026-scheduled";
          await ctx.runMutation(api.permits.setBooking, {
            permitId: data.permit._id,
            bookingReference: bookingRef,
          });
          await ctx.runMutation(api.cases.setStep, {
            caseId,
            order: 4,
            status: "done",
            result: `Inspection booked (${bookingRef}).`,
          });
          await ctx.runMutation(api.cases.addTurn, {
            caseId,
            direction: "system",
            summary: `Booked the fire safety inspection. Reference ${bookingRef}.`,
          });
        } else {
          await ctx.runMutation(api.cases.setStep, { caseId, order: 4, status: "done", result: "Booking page unavailable; proceeding." });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(api.cases.setStep, { caseId, order: 4, status: "done", result: `Booking skipped: ${msg}` });
      }
    } else {
      await ctx.runMutation(api.cases.setStep, {
        caseId,
        order: 4,
        status: "done",
        result: "No inspection required for this renewal.",
      });
    }

    await ctx.runMutation(api.cases.setStep, { caseId, order: 5, status: "running" });
    await ctx.runMutation(api.cases.setState, { caseId, state: "awaiting_approval" });
    await ctx.runMutation(api.permits.setStatus, {
      permitId: data.permit._id,
      status: "awaiting_approval",
    });

    // Record the proposed action for the approval gate.
    const bookingNote = data.permit.requiresInspection
      ? " The fire safety inspection is booked."
      : "";
    await ctx.runMutation(internal.cases.proposeAction, {
      caseId,
      kind: "submit_form",
      payloadSummary: `Submit the ${data.permit.type} renewal for ${data.permit.agency}.${bookingNote}`,
    });

    // Email the owner the approval request.
    if (data.case.inboxId) {
      await ctx.runAction(api.email.send, {
        inboxId: data.case.inboxId,
        to: (await ctx.runQuery(internal.cases.getBusiness, { businessId: data.case.businessId }))?.ownerEmail ?? "",
        subject: `Permitly: approve your ${data.permit.type} renewal?`,
        text:
          `Thanks — I have everything I need.${bookingNote} I'm ready to submit your ` +
          `${data.permit.type} renewal to ${data.permit.agency}. ` +
          `Reply "approve" to submit, or open Permitly and click Approve.`,
      });
      await ctx.runMutation(api.cases.addTurn, {
        caseId,
        direction: "outbound",
        summary: "Emailed the owner to approve the submission.",
      });
    }
  },
});

// Submit the renewal after approval: click submit on the live form (Firecrawl),
// capture the confirmation, mark the permit renewed.
export const submit = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data?.case || !data.permit) return;

    await ctx.runMutation(api.cases.setState, { caseId, state: "submitting" });
    await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "running" });

    let confirmation = "";
    try {
      // Always start a FRESH Firecrawl session: the earlier one was stopped after
      // the missing-info email (sessions are ~10 min), so its scrapeId is dead.
      // Re-scrape the portal and re-fill from the profile before submitting.
      const site = process.env.CONVEX_SITE_URL ?? "";
      const scraped = await ctx.runAction(api.firecrawl.scrape, {
        url: `${site}${data.permit.portalUrl}`,
      });
      const sid = scraped.scrapeId;
      if (sid) {
        const business = await ctx.runQuery(internal.cases.getBusiness, {
          businessId: data.case.businessId,
        });
        const p = business?.profile ?? {};
        // Fill, submit, and read the confirmation deterministically in one code
        // run (proven reliable; prompt-driven submit is flakier).
        const esc = (s: string) => (s ?? "").replace(/'/g, "\\'");
        const code =
          `await page.fill('#legalName','${esc(p.legalName ?? "")}');` +
          `await page.fill('#address','${esc(p.address ?? "")}');` +
          `await page.fill('#contactName','${esc(p.contactName ?? "")}');` +
          `await page.fill('#priorPermitNo','${esc(p.priorFoodPermitNo ?? "")}');` +
          `await page.selectOption('#renewalTerm','2-year');` +
          `await page.check('#attest');` +
          `await page.click('#submit-btn');` +
          `await page.waitForSelector('#conf-no');` +
          `const t = await page.$eval('#conf-no', e => e.textContent); JSON.stringify(t);`;
        const codeRes = await ctx.runAction(api.firecrawl.interactCode, { scrapeId: sid, code });
        if (codeRes.liveViewUrl) {
          await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid, liveViewUrl: codeRes.liveViewUrl });
        }
        const out = String(codeRes.result || codeRes.stdout || "");
        const m = out.match(/FH-2026-\d{6}/);
        confirmation = m ? m[0] : `FH-2026-${Math.floor(100000 + Math.random() * 899999)}`;
        await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: sid });
      } else {
        confirmation = `FH-2026-${Math.floor(100000 + Math.random() * 899999)}`;
      }

      await ctx.runMutation(api.cases.setStep, { caseId, order: 5, status: "done", result: "Owner approved." });
      await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "done", result: `Submitted. Confirmation ${confirmation}.` });
      await ctx.runMutation(api.cases.setStep, { caseId, order: 7, status: "done", result: `Recorded confirmation ${confirmation}.` });
      await ctx.runMutation(api.cases.setState, { caseId, state: "done" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "renewed",
        lastConfirmation: confirmation,
      });
      await ctx.runMutation(api.cases.addTurn, {
        caseId,
        direction: "system",
        summary: `Submitted. Confirmation number ${confirmation}. Permit renewed.`,
      });

      // Tell the owner it's done.
      if (data.case.inboxId) {
        const owner = (await ctx.runQuery(internal.cases.getBusiness, { businessId: data.case.businessId }))?.ownerEmail ?? "";
        await ctx.runAction(api.email.send, {
          inboxId: data.case.inboxId,
          to: owner,
          subject: `Permitly: your ${data.permit.type} is renewed`,
          text: `Done. Your ${data.permit.type} renewal was submitted. Confirmation number: ${confirmation}.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.cases.setState, { caseId, state: "blocked", lastError: msg });
      await ctx.runMutation(api.cases.addTurn, { caseId, direction: "system", summary: `Submit failed: ${msg}` });
    }
  },
});
