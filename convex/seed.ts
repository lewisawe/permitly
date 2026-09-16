import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

const DAY = 24 * 60 * 60 * 1000;
// Seed a fictional demo business with a spread of permits, so the board is
// populated for the no-account demo path (DESIGN.md). Idempotent-ish: it skips
// if a demo business already exists.
export const demo = mutation({
  args: {},
  handler: async (ctx) => {
    // Owner email comes from an env var so a real address is never committed to
    // the repo. Falls back to a fictional demo address when unset.
    const ownerEmail = process.env.DEMO_OWNER_EMAIL ?? "owner@brickovenpizza.demo";

    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", ownerEmail))
      .first();
    if (existing) return { businessId: existing._id, seeded: false };

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
      name: "Brick Oven Pizza (DEMO)",
      ownerEmail,
      profile: {
        legalName: "Brick Oven Pizza LLC",
        address: "142 Main St, Springfield",
        contactName: "Sam Rivera",
        priorPermitNo: "FH-2025-0417",
      },
    });

    const permits: Array<{
      type: string;
      agency: string;
      portalUrl: string;
      portalSlug: string;
      deadline: number;
      status:
        | "tracked"
        | "in_progress"
        | "awaiting_info"
        | "awaiting_approval"
        | "submitted"
        | "renewed"
        | "failed";
      requiresInspection?: boolean;
      bookingUrl?: string;
    }> = [
      {
        type: "Food Handler Permit",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/login",
        portalSlug: "food-handler",
        deadline: now + 3 * DAY, // due soon (red)
        status: "tracked",
        requiresInspection: true,
        bookingUrl: "/demo-portal/booking",
      },
      {
        type: "Business License",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/login",
        portalSlug: "business-license",
        deadline: now + 12 * DAY, // amber
        status: "tracked",
      },
      {
        type: "Fire Safety Inspection",
        agency: "Springfield Fire Dept",
        portalUrl: "/demo-portal/login",
        portalSlug: "fire-safety",
        deadline: now + 45 * DAY, // neutral
        status: "tracked",
      },
      {
        type: "Sign Permit",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/login",
        portalSlug: "sign",
        deadline: now - 2 * DAY, // overdue (red)
        status: "failed",
      },
    ];

    for (const p of permits) {
      await ctx.db.insert("permits", { businessId, ...p });
    }

    return { businessId, seeded: true, count: permits.length };
  },
});

// Full wipe (businesses + permits + case data) then re-seed fresh. For demo
// resets after schema changes.
export const reseed = mutation({
  args: {},
  handler: async (ctx): Promise<{ reseeded: boolean }> => {
    for (const t of ["actions", "turns", "steps", "cases", "permits", "businesses"] as const) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    await ctx.runMutation(api.seed.demo, {});
    return { reseeded: true };
  },
});
// so the demo can be re-run from a clean board. Keeps businesses + permits.
export const resetCases = mutation({
  args: {},
  handler: async (ctx) => {
    for (const t of ["actions", "turns", "steps", "cases"] as const) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // Reset permits that were mid-renewal back to tracked (leave "failed"/"renewed").
    const permits = await ctx.db.query("permits").collect();
    for (const p of permits) {
      if (
        p.status === "in_progress" ||
        p.status === "awaiting_info" ||
        p.status === "awaiting_approval" ||
        p.status === "submitted"
      ) {
        await ctx.db.patch(p._id, { status: "tracked" });
      }
    }
    return { cleared: true };
  },
});
