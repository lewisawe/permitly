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
