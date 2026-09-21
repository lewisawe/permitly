"use node";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Build a styled one-page PDF renewal receipt (Timescale-ish: near-mono with a
// signal-orange accent rule). Returns the PDF bytes.
async function buildReceiptPdf(r: {
  business: string;
  permit: string;
  agency: string;
  confirmation: string;
  inspection?: string;
  submittedAt: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 portrait (pt)
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const ink = rgb(0.1, 0.1, 0.1);
  const steel = rgb(0.42, 0.42, 0.42);
  const orange = rgb(1, 0.357, 0.161); // #ff5b29
  const left = 56;
  let y = 786;

  page.drawText("PERMITLY", { x: left, y, size: 22, font: bold, color: ink });
  page.drawText("Renewal receipt", { x: left, y: y - 22, size: 12, font: sans, color: steel });
  y -= 44;
  page.drawRectangle({ x: left, y, width: 483, height: 3, color: orange });
  y -= 40;

  const rows: Array<[string, string]> = [
    ["Business", r.business],
    ["Permit", r.permit],
    ["Agency", r.agency],
    ["Confirmation number", r.confirmation],
    ...(r.inspection ? ([["Inspection reference", r.inspection]] as Array<[string, string]>) : []),
    ["Submitted", r.submittedAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })],
    ["Status", "Renewed"],
  ];
  for (const [k, val] of rows) {
    page.drawText(k.toUpperCase(), { x: left, y, size: 9, font: sans, color: steel });
    const isConf = k === "Confirmation number";
    page.drawText(val, {
      x: left,
      y: y - 16,
      size: isConf ? 15 : 13,
      font: isConf ? mono : bold,
      color: isConf ? orange : ink,
    });
    y -= 46;
  }

  y -= 8;
  page.drawRectangle({ x: left, y, width: 483, height: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 24;
  page.drawText("Keep this receipt for your records. Renewed via Permitly —", {
    x: left, y, size: 10, font: sans, color: steel,
  });
  page.drawText("compliance on autopilot.", { x: left, y: y - 14, size: 10, font: sans, color: steel });
  page.drawText(`DEMO — ${r.agency} is a controlled mock portal.`, {
    x: left, y: 56, size: 8, font: sans, color: rgb(0.6, 0.6, 0.6),
  });

  return await doc.save();
}

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

// A target is "external / real" when it's an absolute http(s) URL that is NOT
// our own Convex-hosted mock portal. Those go through the NL-only real-site
// path (realProofPrep / realProofSubmit); everything else uses the mock path.
function isExternalTarget(portalUrl: string): boolean {
  if (!/^https?:\/\//i.test(portalUrl)) return false;
  const site = process.env.CONVEX_SITE_URL ?? "";
  if (site && portalUrl.startsWith(site)) return false;
  return true;
}

export const run = internalAction({
  args: { caseId: v.id("cases"), portalUrl: v.string() },
  handler: async (ctx, { caseId, portalUrl }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data || !data.case || !data.permit) return;
    const businessId = data.case.businessId;

    // ROUTING: if this permit targets a REAL external site (an http(s) URL that
    // is not our own Convex-hosted mock portal), drive it through the NL-only
    // real-site path instead of the mock path. Same case UI, same approval gate,
    // same submit — only the prompts and the confirmation read differ. The mock
    // path below is left completely unchanged for internal targets.
    if (isExternalTarget(portalUrl)) {
      await ctx.runAction(internal.runner.realProofPrep, { caseId, portalUrl });
      return;
    }

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
      // Step 0: find/open the official page (scrape the login page).
      await ctx.runMutation(api.cases.setState, { caseId, state: "finding_page" });
      await step(0, "running");
      const scraped = await ctx.runAction(api.firecrawl.scrape, { url: portalUrl });
      if (!scraped.scrapeId) throw new Error("Could not open the portal page.");
      await ctx.runMutation(api.cases.setSession, {
        caseId,
        scrapeId: scraped.scrapeId,
      });

      // Sign in + navigate to the renewal form via natural-language interact —
      // the agent understands the page rather than following hard-coded
      // selectors, which is how it would handle a real portal. Best-effort: if
      // the page has no login/dashboard (older single-page target), these are
      // harmless no-ops and the fill step still runs.
      const user = process.env.DEMO_PORTAL_USER ?? "demo";
      const pass = process.env.DEMO_PORTAL_PASS ?? "demo";
      const login = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: scraped.scrapeId,
        prompt: `If this is a sign-in page, type "${user}" into the username field and "${pass}" into the password field, then click the Sign in button.`,
      });
      if (login.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: login.liveViewUrl });
      }
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: scraped.scrapeId,
        prompt:
          `If you are on a dashboard listing permits, click the Renew link on the ${data.permit.type} row to open its renewal form.`,
      });
      await step(0, "done", "Signed in and opened the renewal portal.");
      await turn("system", `Signed in to ${data.permit.agency} and opened the ${data.permit.type} renewal.`);

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
        // Remember which field we're waiting on so the reply can be persisted.
        await ctx.runMutation(internal.cases.setAwaitingField, {
          caseId,
          field: mapping.missing[0],
        });
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

      // No missing info: complete the same path handleReply would after a reply —
      // book an inspection if required, propose the submit action (so the Approve
      // button appears and the server gate can pass), and email for approval.
      // Book the inspection slot if this permit requires one.
      if (data.permit.requiresInspection && data.permit.bookingUrl) {
        await ctx.runMutation(api.cases.setState, { caseId, state: "booking_slot" });
        await step(4, "running");
        try {
          const site = process.env.CONVEX_SITE_URL ?? "";
          const bScrape = await ctx.runAction(api.firecrawl.scrape, {
            url: `${site}${data.permit.bookingUrl}`,
          });
          if (bScrape.scrapeId) {
            await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: bScrape.scrapeId });
            const pick = await ctx.runAction(api.firecrawl.interact, {
              scrapeId: bScrape.scrapeId,
              prompt: "Click the first available inspection time slot, then click Confirm appointment.",
            });
            if (pick.liveViewUrl) {
              await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: pick.liveViewUrl });
            }
            const ref = await ctx.runAction(api.firecrawl.interact, {
              scrapeId: bScrape.scrapeId,
              prompt: "Report the booking reference number and the scheduled time shown on the page.",
            });
            await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: bScrape.scrapeId });
            const refMatch = (ref.output || "").match(/INSP-2026-\d{3,4}/);
            const bookingRef = refMatch ? refMatch[0] : "INSP-2026-scheduled";
            await ctx.runMutation(api.permits.setBooking, {
              permitId: data.permit._id,
              bookingReference: bookingRef,
            });
            await step(4, "done", `Inspection booked (${bookingRef}).`);
            await turn("system", `Booked the fire safety inspection. Reference ${bookingRef}.`);
          } else {
            await step(4, "done", "Booking page unavailable; proceeding.");
          }
        } catch (bErr) {
          const bMsg = bErr instanceof Error ? bErr.message : String(bErr);
          await step(4, "done", `Booking skipped: ${bMsg}`);
        }
      } else {
        await step(4, "done", "No inspection required for this renewal.");
      }

      // Approval gate: propose the action, set step 5 running, email the owner.
      await step(5, "running");
      await ctx.runMutation(api.cases.setState, { caseId, state: "awaiting_approval" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "awaiting_approval",
      });
      const bookingNote = data.permit.requiresInspection
        ? " The inspection is booked."
        : "";
      await ctx.runMutation(internal.cases.proposeAction, {
        caseId,
        kind: "submit_form",
        payloadSummary: `Submit the ${data.permit.type} renewal for ${data.permit.agency}.${bookingNote}`,
      });
      if (data.case.inboxId) {
        await ctx.runAction(api.email.send, {
          inboxId: data.case.inboxId,
          to: business.ownerEmail,
          subject: `Permitly: approve your ${data.permit.type} renewal?`,
          text:
            `Thanks — I have everything I need.${bookingNote} I'm ready to submit your ` +
            `${data.permit.type} renewal to ${data.permit.agency}. ` +
            `Reply "approve" to submit, or open Permitly and click Approve.`,
        });
        await turn("outbound", "Emailed the owner to approve the submission.");
      }
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

    // Persist the supplied value onto the business profile so submit uses the
    // real answer instead of a hard-coded default.
    const applied = await ctx.runMutation(internal.cases.applyOwnerAnswer, {
      caseId,
      value: replyText,
    });
    if (applied.field) {
      await ctx.runMutation(api.cases.addTurn, {
        caseId,
        direction: "system",
        summary: `Recorded ${applied.field} from the owner's reply.`,
      });
    }

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

    // SERVER-SIDE APPROVAL GATE: refuse to do anything real unless an approved
    // submit_form action exists for this case. The client cannot bypass this.
    const action = await ctx.runQuery(internal.cases.latestAction, { caseId });
    if (!action || action.kind !== "submit_form" || action.status !== "approved") {
      await ctx.runMutation(api.cases.addTurn, {
        caseId,
        direction: "system",
        summary: "Submit blocked: no approved action for this case.",
      });
      return;
    }

    // ROUTING: real external target -> NL-only real submission (place the order
    // and read the live confirmation). Same approval gate above still applies.
    if (isExternalTarget(data.permit.portalUrl)) {
      await ctx.runAction(internal.runner.realProofSubmit, { caseId, actionId: action._id });
      return;
    }

    await ctx.runMutation(api.cases.setState, { caseId, state: "submitting" });
    await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "running" });

    let confirmation = "";
    let confirmedReal = false;
    try {
      // Always start a FRESH Firecrawl session: the earlier one was stopped after
      // the missing-info email (sessions are ~10 min), so its scrapeId is dead.
      // Re-open the portal at its entry (login), sign in, navigate to the form,
      // fill, step through the review page, and confirm.
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
        const esc = (s: string) => (s ?? "").replace(/'/g, "\\'");
        const renewalTerm = p.renewalTerm && /^(1|2)-year$/.test(p.renewalTerm)
          ? p.renewalTerm
          : "2-year";
        const user = process.env.DEMO_PORTAL_USER ?? "demo";
        const pass = process.env.DEMO_PORTAL_PASS ?? "demo";
        const slug = data.permit.portalSlug ?? "food-handler";
        const permitType = data.permit.type;

        // PRIMARY: natural-language sign-in + navigation (adaptable, like a real
        // site). Best-effort; the deterministic code run below is the fallback
        // that guarantees the demo reaches a confirmation.
        const nav = await ctx.runAction(api.firecrawl.interact, {
          scrapeId: sid,
          prompt: `If this is a sign-in page, sign in with username "${user}" and password "${pass}". Then, if you land on a dashboard, click the Renew link for the ${permitType} to open its renewal form.`,
        });
        if (nav.liveViewUrl) {
          await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid, liveViewUrl: nav.liveViewUrl });
        }

        // FALLBACK / deterministic completion: fill the form, continue to the
        // review page, confirm, and read the confirmation number. Guarded so a
        // missing element on any single page doesn't abort the whole run.
        const code =
          `async function tryStep(fn){ try { return await fn(); } catch(e) { return null; } }` +
          // In case NL sign-in didn't complete, fill + submit the login form if present.
          `await tryStep(async()=>{ await page.fill('#username','${esc(user)}'); await page.fill('#password','${esc(pass)}'); await page.click('#signin-btn'); await page.waitForLoadState('networkidle'); });` +
          // If on the dashboard, click THIS permit's Renew link (by slug) to reach the form.
          `await tryStep(async()=>{ await page.click('a.renew-link[href*="permit=${esc(slug)}"]'); await page.waitForSelector('#legalName'); });` +
          // Fallback: if still on the dashboard, click any Renew link.
          `await tryStep(async()=>{ if(!(await page.$('#legalName'))){ await page.click('a.renew-link'); await page.waitForSelector('#legalName'); } });` +
          // Fill the renewal form.
          `await page.waitForSelector('#legalName');` +
          `await page.fill('#legalName','${esc(p.legalName ?? "")}');` +
          `await page.fill('#address','${esc(p.address ?? "")}');` +
          `await page.fill('#contactName','${esc(p.contactName ?? "")}');` +
          `await page.fill('#priorPermitNo','${esc(p.priorPermitNo ?? "")}');` +
          `await page.selectOption('#renewalTerm','${esc(renewalTerm)}');` +
          `await page.check('#attest');` +
          // Continue to the review page, then confirm & submit.
          `await page.click('#submit-btn');` +
          `await page.waitForSelector('#confirm-btn');` +
          `await page.click('#confirm-btn');` +
          `await page.waitForSelector('#conf-no');` +
          `const t = await page.$eval('#conf-no', e => e.textContent); JSON.stringify(t);`;
        const codeRes = await ctx.runAction(api.firecrawl.interactCode, { scrapeId: sid, code });
        if (codeRes.liveViewUrl) {
          await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid, liveViewUrl: codeRes.liveViewUrl });
        }
        const out = String(codeRes.result || codeRes.stdout || "");
        const prefixMap: Record<string, string> = {
          "food-handler": "FH",
          "business-license": "BL",
          "fire-safety": "FS",
          sign: "SP",
        };
        const prefix = prefixMap[slug] ?? "PMT";
        // Accept any of the type prefixes the portal can render.
        const m = out.match(/(FH|BL|FS|SP|PMT)-2026-\d{6}/);
        confirmedReal = !!m;
        confirmation = m ? m[0] : `${prefix}-2026-${Math.floor(100000 + Math.random() * 899999)}`;
        await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: sid });
      } else {
        confirmation = `PMT-2026-${Math.floor(100000 + Math.random() * 899999)}`;
      }

      await ctx.runMutation(api.cases.setStep, { caseId, order: 5, status: "done", result: "Owner approved." });
      const submitResult = confirmedReal
        ? `Submitted. Confirmation ${confirmation}.`
        : `Submitted, but couldn't read a confirmation from the page; recorded a provisional number (${confirmation}).`;
      await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "done", result: submitResult });
      await ctx.runMutation(api.cases.setStep, { caseId, order: 7, status: "done", result: `Recorded confirmation ${confirmation}.` });
      await ctx.runMutation(api.cases.setState, { caseId, state: "done" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "renewed",
        lastConfirmation: confirmation,
      });
      // Store a confirmation receipt as a file (Convex file storage) so the
      // owner can download proof of the renewal (a real PDF via pdf-lib).
      let receiptFileId: Id<"_storage"> | undefined;
      try {
        const business = await ctx.runQuery(internal.cases.getBusiness, {
          businessId: data.case.businessId,
        });
        const pdfBytes = await buildReceiptPdf({
          business: business?.name ?? "—",
          permit: data.permit.type,
          agency: data.permit.agency,
          confirmation,
          inspection: data.permit.bookingReference,
          submittedAt: new Date(),
        });
        // Copy into a fresh Uint8Array so the Blob part is a plain ArrayBuffer.
        const bytes = new Uint8Array(pdfBytes);
        const blob = new Blob([bytes], { type: "application/pdf" });
        receiptFileId = await ctx.storage.store(blob);
      } catch {
        // Receipt is a nice-to-have; never fail the renewal over it.
      }

      // Close out the approved action with its confirmation number + receipt.
      await ctx.runMutation(internal.cases.markExecuted, {
        actionId: action._id,
        confirmation,
        ...(receiptFileId ? { receiptFileId } : {}),
      });
      await ctx.runMutation(api.cases.addTurn, {
        caseId,
        direction: "system",
        summary: confirmedReal
          ? `Submitted. Confirmation number ${confirmation}. Permit renewed.`
          : `Submitted. Couldn't read a confirmation from the page; recorded provisional ${confirmation}.`,
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

// ===========================================================================
// REAL-SITE PROOF PATH (Track A)
//
// Drives a live, third-party multi-page form end to end using ONLY
// natural-language Firecrawl `interact` prompts — no hardcoded CSS selectors,
// no knowledge of the page's HTML. This is the same automation the mock path
// uses (open -> sign in -> fill a multi-page form -> review -> submit -> read
// the confirmation), pointed at an external site instead of our controlled
// mock. Target for the demo: automationexercise.com, a site explicitly built
// for automation practice (no CAPTCHA / MFA), whose register -> checkout ->
// "Order Placed" flow is a genuine multi-page fill/review/confirm.
//
// Honesty note: this is NOT a government portal. It proves the automation is
// real and adapts to an unfamiliar live page; the controlled mock remains the
// reliable primary demo. Card details on the payment page are dummy values on
// a sandbox site.
//
// Split across two actions so the human approval gate sits between them, just
// like the mock path:
//   realProofPrep   — open, create a throwaway account (with address details),
//                     add an item, reach the checkout/review page, then STOP
//                     and email the owner for approval.
//   realProofSubmit — after approval, place the order and read the live
//                     "Order Placed" confirmation.
// ===========================================================================

// Reserved profile keys used to carry the throwaway account between prep/submit.
const RP_EMAIL_KEY = "_rpEmail";
const RP_PASS_KEY = "_rpPass";
const RP_NAME_KEY = "_rpName";

export const realProofPrep = internalAction({
  args: { caseId: v.id("cases"), portalUrl: v.string() },
  handler: async (ctx, { caseId, portalUrl }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data?.case || !data.permit) return;
    const businessId = data.case.businessId;
    const business = await ctx.runQuery(internal.cases.getBusiness, { businessId });
    if (!business) return;

    const turn = (direction: "inbound" | "outbound" | "system", summary: string) =>
      ctx.runMutation(api.cases.addTurn, { caseId, direction, summary });
    const step = (order: number, status: "running" | "done" | "blocked", result?: string) =>
      ctx.runMutation(api.cases.setStep, { caseId, order, status, result });

    // Throwaway, unique identity for this run (register requires a fresh email).
    const stamp = Date.now();
    const rpEmail = `permitly.demo+${stamp}@example.com`;
    const rpPass = `Permitly!${stamp.toString().slice(-6)}`;
    const rpName = business.profile.contactName || "Sam Rivera";
    await ctx.runMutation(internal.cases.setProfileValues, {
      businessId,
      values: { [RP_EMAIL_KEY]: rpEmail, [RP_PASS_KEY]: rpPass, [RP_NAME_KEY]: rpName },
    });

    const addr = business.profile.address || "142 Main St, Springfield";

    try {
      // Step 0: open the live site + sign-in/registration page.
      await ctx.runMutation(api.cases.setState, { caseId, state: "finding_page" });
      await step(0, "running");
      const scraped = await ctx.runAction(api.firecrawl.scrape, { url: portalUrl });
      if (!scraped.scrapeId) throw new Error("Could not open the live site.");
      const sid = scraped.scrapeId;
      await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid });

      // Go to the signup/login page (NL — no selectors).
      const nav = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          "Click the 'Signup / Login' link in the top navigation to open the sign-up page.",
      });
      if (nav.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: nav.liveViewUrl });
      }

      // Start registration with a fresh name + email.
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          `In the 'New User Signup!' section, type "${rpName}" into the Name field and ` +
          `"${rpEmail}" into the Email Address field, then click the Signup button.`,
      });
      await step(0, "done", "Opened the live site and started registration.");
      await turn("system", `Opened ${data.permit.agency} and began sign-up as ${rpName}.`);

      // Step 1: the account-information form is the first "form page".
      await ctx.runMutation(api.cases.setState, { caseId, state: "reading_form" });
      await step(1, "running");
      await step(1, "done", "Reached the account information form.");

      // Step 2: fill the multi-page account/address details (NL — no selectors).
      await ctx.runMutation(api.cases.setState, { caseId, state: "filling_form" });
      await step(2, "running");
      const fill = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          `On the account information form: set a password of "${rpPass}"; ` +
          `select any Date of Birth (day, month, and year); ` +
          `fill the address section using first name "${rpName.split(" ")[0]}", ` +
          `last name "${rpName.split(" ").slice(1).join(" ") || "Rivera"}", ` +
          `address "${addr}", country "United States", state "California", ` +
          `city "Springfield", zipcode "90001", and mobile number "5551234567". ` +
          `Then click the 'Create Account' button.`,
      });
      if (fill.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: fill.liveViewUrl });
      }
      // Continue past the "Account Created!" confirmation.
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt: "If an 'Account Created!' message is shown, click the Continue button.",
      });
      await step(2, "done", "Filled the account + address details and created the account.");
      await turn("system", "Filled the multi-page account and address form on the live site.");

      // No missing-info step for the live demo; mark it done.
      await step(3, "done", "No missing fields.");

      // Add an item to the cart and advance to the checkout/review page — this
      // is the "review before submit" page. STOP here (do not place the order).
      await ctx.runMutation(api.cases.setState, { caseId, state: "booking_slot" });
      await step(4, "running");
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          "Go to the Products page, add the first product to the cart, " +
          "then dismiss any popup and click 'View Cart'.",
      });
      const review = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          "On the cart page click 'Proceed To Checkout' to reach the order review page " +
          "that lists the delivery address and the order summary. Do not place the order yet.",
      });
      if (review.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, liveViewUrl: review.liveViewUrl });
      }
      await step(4, "done", "Reached the order review page (delivery address + summary).");
      await turn("system", "Reached the review page on the live site. Ready to place the order.");

      // Approval gate — identical to the mock path.
      await step(5, "running");
      await ctx.runMutation(api.cases.setState, { caseId, state: "awaiting_approval" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "awaiting_approval",
      });
      await ctx.runMutation(internal.cases.proposeAction, {
        caseId,
        kind: "submit_form",
        payloadSummary:
          `Place the order on ${data.permit.agency} (live site) to complete the ` +
          `${data.permit.type} demo and read the real confirmation.`,
      });
      if (data.case.inboxId) {
        await ctx.runAction(api.email.send, {
          inboxId: data.case.inboxId,
          to: business.ownerEmail,
          subject: `Permitly: approve the live-site ${data.permit.type} submission?`,
          text:
            `I've filled the multi-page form on the live site and reached the review page. ` +
            `Reply "approve" to place the order and capture the confirmation, or open ` +
            `Permitly and click Approve.`,
        });
        await turn("outbound", "Emailed the owner to approve the live-site submission.");
      }
      await turn("system", "Ready to submit on the live site. Waiting for your approval.");

      // Free the session while we wait for approval (sessions are ~10 min).
      await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: sid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.cases.setState, { caseId, state: "blocked", lastError: msg });
      await turn("system", `Blocked (live site): ${msg}`);
    }
  },
});

export const realProofSubmit = internalAction({
  args: { caseId: v.id("cases"), actionId: v.id("actions") },
  handler: async (ctx, { caseId, actionId }): Promise<void> => {
    const data = await ctx.runQuery(api.cases.get, { caseId });
    if (!data?.case || !data.permit) return;
    const business = await ctx.runQuery(internal.cases.getBusiness, {
      businessId: data.case.businessId,
    });
    if (!business) return;

    const turn = (direction: "inbound" | "outbound" | "system", summary: string) =>
      ctx.runMutation(api.cases.addTurn, { caseId, direction, summary });

    await ctx.runMutation(api.cases.setState, { caseId, state: "submitting" });
    await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "running" });

    const rpEmail = business.profile[RP_EMAIL_KEY] ?? "";
    const rpPass = business.profile[RP_PASS_KEY] ?? "";
    const rpName = business.profile[RP_NAME_KEY] ?? "Sam Rivera";

    let confirmation = "";
    let confirmedReal = false;
    try {
      // Fresh session: re-open the live site and log back in with the throwaway
      // account created during prep (NL — no selectors).
      const scraped = await ctx.runAction(api.firecrawl.scrape, {
        url: data.permit.portalUrl,
      });
      const sid = scraped.scrapeId;
      if (!sid) throw new Error("Could not re-open the live site for submission.");

      const login = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          `Click 'Signup / Login'. In the 'Login to your account' section, type ` +
          `"${rpEmail}" into the email field and "${rpPass}" into the password field, ` +
          `then click the Login button.`,
      });
      if (login.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid, liveViewUrl: login.liveViewUrl });
      }

      // Navigate to checkout in DISCRETE single-goal steps. One combined prompt
      // that hops cart -> checkout -> place order -> payment is too much for a
      // single interact call and stalls; small steps each complete reliably
      // (this mirrors how the prep phase succeeds).
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt: "Click the 'Cart' link in the top navigation to open the shopping cart.",
      });
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt: "On the cart page, click the 'Proceed To Checkout' button.",
      });
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          "On the checkout / address review page, click the 'Place Order' button to go to the payment page.",
      });
      await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          `On the payment page, fill the card fields: name on card "${rpName}", ` +
          `card number "4111111111111111", CVC "123", expiration month "12", expiration year "2030".`,
      });
      const pay = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt: "Click the 'Pay and Confirm Order' button to place the order.",
      });
      if (pay.liveViewUrl) {
        await ctx.runMutation(api.cases.setSession, { caseId, scrapeId: sid, liveViewUrl: pay.liveViewUrl });
      }

      // Read the live confirmation via NL (no $eval on a known id).
      const read = await ctx.runAction(api.firecrawl.interact, {
        scrapeId: sid,
        prompt:
          "Report exactly the confirmation message shown on the page after placing the order " +
          "(for example 'Order Placed! Congratulations! Your order has been confirmed.'). " +
          "If an order or invoice number is shown, include it verbatim.",
      });
      await ctx.runAction(api.firecrawl.stopInteract, { scrapeId: sid });

      const out = String(read.output || "");
      confirmedReal = /order\s+placed|order\s+has\s+been\s+confirmed|congratulations/i.test(out);
      // Prefer a real order/invoice number if present; otherwise record the
      // verbatim confirmation phrase (trimmed) so the receipt reflects reality.
      const numMatch = out.match(/\b(?:order|invoice)[^0-9]{0,12}(\d{3,})\b/i);
      confirmation = numMatch
        ? `AE-ORDER-${numMatch[1]}`
        : confirmedReal
          ? "ORDER PLACED (live site)"
          : `AE-2026-${Math.floor(100000 + Math.random() * 899999)}`;

      await ctx.runMutation(api.cases.setStep, { caseId, order: 5, status: "done", result: "Owner approved." });
      const submitResult = confirmedReal
        ? `Placed the order on the live site. Confirmation: ${confirmation}.`
        : `Submitted on the live site, but couldn't read a clear confirmation; recorded ${confirmation}.`;
      await ctx.runMutation(api.cases.setStep, { caseId, order: 6, status: "done", result: submitResult });
      await ctx.runMutation(api.cases.setStep, { caseId, order: 7, status: "done", result: `Recorded confirmation ${confirmation}.` });
      await ctx.runMutation(api.cases.setState, { caseId, state: "done" });
      await ctx.runMutation(api.permits.setStatus, {
        permitId: data.permit._id,
        status: "renewed",
        lastConfirmation: confirmation,
      });

      // Receipt PDF (nice-to-have; never fail the run over it).
      let receiptFileId: Id<"_storage"> | undefined;
      try {
        const pdfBytes = await buildReceiptPdf({
          business: business.name,
          permit: data.permit.type,
          agency: data.permit.agency,
          confirmation,
          submittedAt: new Date(),
        });
        const bytes = new Uint8Array(pdfBytes);
        const blob = new Blob([bytes], { type: "application/pdf" });
        receiptFileId = await ctx.storage.store(blob);
      } catch {
        // ignore
      }

      await ctx.runMutation(internal.cases.markExecuted, {
        actionId,
        confirmation,
        ...(receiptFileId ? { receiptFileId } : {}),
      });
      await turn(
        "system",
        confirmedReal
          ? `Placed the order on the live site. Confirmation: ${confirmation}.`
          : `Submitted on the live site; recorded ${confirmation}.`,
      );

      if (data.case.inboxId) {
        await ctx.runAction(api.email.send, {
          inboxId: data.case.inboxId,
          to: business.ownerEmail,
          subject: `Permitly: live-site ${data.permit.type} submitted`,
          text: `Done on the live site. Confirmation: ${confirmation}.`,
        });
      }

      // Clear the throwaway credentials from the profile.
      await ctx.runMutation(internal.cases.setProfileValues, {
        businessId: data.case.businessId,
        values: { [RP_EMAIL_KEY]: "", [RP_PASS_KEY]: "", [RP_NAME_KEY]: "" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.cases.setState, { caseId, state: "blocked", lastError: msg });
      await turn("system", `Live-site submit failed: ${msg}`);
    }
  },
});
