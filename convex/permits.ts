import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { permitStatus } from "./schema";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { getAuthUserId } from "@convex-dev/auth/server";

// Rate limit real, credit-costing renewal runs per business: a token bucket that
// allows a small burst then refills slowly. Firecrawl /interact costs credits,
// so this protects against accidental/abusive repeat triggers.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  startRenewal: { kind: "token bucket", rate: 3, period: MINUTE, capacity: 2 },
});

// Board data: the caller's business (owner-scoped) with each permit's active
// case. Falls back to the shared demo business so a first-time anonymous visitor
// (a judge opening the live URL) always sees a populated board.
export const board = query({
  args: { businessId: v.optional(v.id("businesses")) },
  handler: async (ctx, { businessId }) => {
    const userId = await getAuthUserId(ctx);

    let business = null;
    if (businessId) {
      business = await ctx.db.get(businessId);
    } else if (userId) {
      // The caller's own business, if they have one.
      business = await ctx.db
        .query("businesses")
        .withIndex("by_owner_id", (q) => q.eq("ownerId", userId))
        .first();
    }
    // Fallback: the shared demo business (no-account demo path).
    if (!business) {
      business = (await ctx.db.query("businesses").take(1))[0] ?? null;
    }
    if (!business) return { business: null, permits: [] };

    // Permits per business are few (a business tracks ~5-15); bound anyway so we
    // never .collect() an unbounded set (SPEC section 5).
    const permits = await ctx.db
      .query("permits")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .take(100);

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

// Store the inspection booking reference on a permit.
export const setBooking = mutation({
  args: { permitId: v.id("permits"), bookingReference: v.string() },
  handler: async (ctx, { permitId, bookingReference }) => {
    await ctx.db.patch(permitId, { bookingReference });
  },
});

// Start a renewal from the board: open a case for this permit, then kick off
// the runner (scrape -> fill -> ask/approve) against the demo portal.
export const startRenewal = mutation({
  args: { permitId: v.id("permits") },
  handler: async (ctx, { permitId }): Promise<Id<"cases">> => {
    // Require an identity: the server resolves the caller (no anonymous writes
    // without a session). Anonymous auth issues this on page load.
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Please wait a moment and try again (signing you in).");
    }

    // Rate-limit renewal runs per business (real Firecrawl web actions cost
    // credits). Keyed by the permit's business; throws a ConvexError the client
    // can surface if the limit is exceeded.
    const permitForLimit = await ctx.db.get(permitId);
    if (permitForLimit) {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "startRenewal", {
        key: permitForLimit.businessId,
      });
      if (!ok) {
        const secs = Math.ceil((retryAfter ?? 0) / 1000);
        throw new ConvexError(
          `Too many renewals started just now. Try again in about ${secs}s.`,
        );
      }
    }

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

// Deadline watch (called by the daily cron). For every permit still "tracked"
// whose deadline falls within `withinDays`, open a renewal case and kick off the
// runner. The human approval gate still stops before any real submission — this
// only starts the automated prep so nothing lapses unattended. Idempotent:
// cases.open returns the existing open case if one is already running.
export const watchDeadlines = internalMutation({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, { withinDays }): Promise<{ opened: number }> => {
    const horizon = Date.now() + (withinDays ?? 7) * 24 * 60 * 60 * 1000;
    const due = await ctx.db
      .query("permits")
      .withIndex("by_deadline", (q) => q.lte("deadline", horizon))
      .take(100);

    let opened = 0;
    for (const permit of due) {
      if (permit.status !== "tracked") continue;
      const caseId: Id<"cases"> = await ctx.runMutation(api.cases.open, {
        permitId: permit._id,
        inboxId: process.env.PERMITLY_INBOX_ID,
      });
      const site = process.env.CONVEX_SITE_URL ?? "";
      const portalUrl = permit.portalUrl.startsWith("http")
        ? permit.portalUrl
        : `${site}${permit.portalUrl}`;
      await ctx.scheduler.runAfter(0, internal.runner.run, { caseId, portalUrl });
      opened++;
    }
    return { opened };
  },
});
