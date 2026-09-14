import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { permitStatus } from "./schema";

// Board data: all permits for a business, with their active case (if any).
export const board = query({
  args: { businessId: v.optional(v.id("businesses")) },
  handler: async (ctx, { businessId }) => {
    const business = businessId
      ? await ctx.db.get(businessId)
      : (await ctx.db.query("businesses").take(1))[0];
    if (!business) return { business: null, permits: [] };

    const permits = await ctx.db
      .query("permits")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    const withCase = await Promise.all(
      permits.map(async (p) => {
        const activeCase = await ctx.db
          .query("cases")
          .withIndex("by_permit", (q) => q.eq("permitId", p._id))
          .order("desc")
          .first();
        return { ...p, activeCase };
      }),
    );

    return { business, permits: withCase };
  },
});

// Add a permit to track.
export const add = mutation({
  args: {
    businessId: v.id("businesses"),
    type: v.string(),
    agency: v.string(),
    portalUrl: v.string(),
    deadline: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("permits", { ...args, status: "tracked" });
  },
});

// Update a permit's status (used by the case engine).
export const setStatus = mutation({
  args: {
    permitId: v.id("permits"),
    status: permitStatus,
    lastConfirmation: v.optional(v.string()),
  },
  handler: async (ctx, { permitId, status, lastConfirmation }) => {
    await ctx.db.patch(permitId, {
      status,
      ...(lastConfirmation ? { lastConfirmation } : {}),
    });
  },
});

// Start a renewal from the board: open a case for this permit, then kick off
// the runner (scrape -> fill -> ask/approve) against the demo portal.
export const startRenewal = mutation({
  args: { permitId: v.id("permits") },
  handler: async (ctx, { permitId }): Promise<Id<"cases">> => {
    const caseId: Id<"cases"> = await ctx.runMutation(api.cases.open, {
      permitId,
      inboxId: process.env.PERMITLY_INBOX_ID,
    });
    const permit = await ctx.db.get(permitId);
    if (permit) {
      // Build the public portal URL: SITE_URL + the permit's portal path.
      const site = process.env.CONVEX_SITE_URL ?? "";
      const portalUrl = permit.portalUrl.startsWith("http")
        ? permit.portalUrl
        : `${site}${permit.portalUrl}`;
      await ctx.scheduler.runAfter(0, internal.runner.run, { caseId, portalUrl });
    }
    return caseId;
  },
});
