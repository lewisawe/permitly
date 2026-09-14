import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
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

// Start a renewal from the board: open a case for this permit.
export const startRenewal = mutation({
  args: { permitId: v.id("permits") },
  handler: async (ctx, { permitId }): Promise<Id<"cases">> => {
    return await ctx.runMutation(api.cases.open, { permitId });
  },
});
