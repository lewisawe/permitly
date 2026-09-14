import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { caseState, stepStatus } from "./schema";

// The ordered step plan every renewal case starts with (SPEC section 6).
const PLAN: Array<{ kind: string; detail: string }> = [
  { kind: "find_page", detail: "Find the official renewal page" },
  { kind: "read_form", detail: "Read the renewal form fields" },
  { kind: "fill_form", detail: "Fill the form from the business profile" },
  { kind: "request_info", detail: "Ask the owner for any missing field" },
  { kind: "book_slot", detail: "Book an inspection slot if required" },
  { kind: "await_approval", detail: "Get owner approval before submitting" },
  { kind: "submit", detail: "Submit the renewal" },
  { kind: "record_receipt", detail: "Record the confirmation number" },
];

// Full case view for the timeline UI: case + permit + steps + turns + actions.
export const get = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = await ctx.db.get(caseId);
    if (!c) return null;
    const permit = await ctx.db.get(c.permitId);
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_case_order", (q) => q.eq("caseId", caseId))
      .collect();
    const turns = await ctx.db
      .query("turns")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    return { case: c, permit, steps, turns, actions };
  },
});

// Create a case for a permit with the standard step plan. Idempotent per permit:
// returns the existing open case if one is already running.
export const open = mutation({
  args: {
    permitId: v.id("permits"),
    threadId: v.optional(v.string()),
    inboxId: v.optional(v.string()),
    firstTurn: v.optional(v.string()),
  },
  handler: async (ctx, { permitId, threadId, inboxId, firstTurn }) => {
    const permit = await ctx.db.get(permitId);
    if (!permit) throw new Error("permit not found");

    const existing = await ctx.db
      .query("cases")
      .withIndex("by_permit", (q) => q.eq("permitId", permitId))
      .order("desc")
      .first();
    if (existing && existing.state !== "done" && existing.state !== "blocked") {
      return existing._id;
    }

    const caseId = await ctx.db.insert("cases", {
      permitId,
      businessId: permit.businessId,
      threadId,
      inboxId,
      state: "intake",
    });

    for (let i = 0; i < PLAN.length; i++) {
      await ctx.db.insert("steps", {
        caseId,
        order: i,
        kind: PLAN[i].kind as any,
        status: i === 0 ? "running" : "pending",
        detail: PLAN[i].detail,
      });
    }

    await ctx.db.insert("turns", {
      caseId,
      threadId,
      direction: firstTurn ? "inbound" : "system",
      summary: firstTurn ?? "Case opened.",
    });

    await ctx.db.patch(permitId, { status: "in_progress" });
    return caseId;
  },
});

// Record a turn (email/agent/system event) on a case.
export const addTurn = mutation({
  args: {
    caseId: v.id("cases"),
    direction: v.union(
      v.literal("inbound"),
      v.literal("outbound"),
      v.literal("system"),
    ),
    summary: v.string(),
  },
  handler: async (ctx, { caseId, direction, summary }) => {
    const c = await ctx.db.get(caseId);
    await ctx.db.insert("turns", {
      caseId,
      threadId: c?.threadId,
      direction,
      summary,
    });
  },
});

// Advance the case state + mark a step done / start the next (used by the engine).
export const setState = mutation({
  args: { caseId: v.id("cases"), state: caseState, lastError: v.optional(v.string()) },
  handler: async (ctx, { caseId, state, lastError }) => {
    await ctx.db.patch(caseId, { state, ...(lastError ? { lastError } : {}) });
  },
});

export const setStep = mutation({
  args: {
    caseId: v.id("cases"),
    order: v.number(),
    status: stepStatus,
    result: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, order, status, result }) => {
    const step = await ctx.db
      .query("steps")
      .withIndex("by_case_order", (q) => q.eq("caseId", caseId).eq("order", order))
      .first();
    if (step) {
      await ctx.db.patch(step._id, { status, ...(result ? { result } : {}) });
    }
  },
});

// Attach a Firecrawl live-view URL + scrapeId to a case (for the UI embed).
export const setSession = mutation({
  args: {
    caseId: v.id("cases"),
    scrapeId: v.optional(v.string()),
    liveViewUrl: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, scrapeId, liveViewUrl }) => {
    await ctx.db.patch(caseId, {
      ...(scrapeId ? { scrapeId } : {}),
      ...(liveViewUrl ? { liveViewUrl } : {}),
    });
  },
});
