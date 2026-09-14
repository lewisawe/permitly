import { mutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;

// Seed a fictional demo business with a spread of permits, so the board is
// populated for the no-account demo path (DESIGN.md). Idempotent-ish: it skips
// if a demo business already exists.
export const demo = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", "owner@brickovenpizza.demo"))
      .first();
    if (existing) return { businessId: existing._id, seeded: false };

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
      name: "Brick Oven Pizza (DEMO)",
      ownerEmail: "owner@brickovenpizza.demo",
      profile: {
        legalName: "Brick Oven Pizza LLC",
        address: "142 Main St, Springfield",
        contactName: "Sam Rivera",
        priorFoodPermitNo: "FH-2025-0417",
      },
    });

    const permits: Array<{
      type: string;
      agency: string;
      portalUrl: string;
      deadline: number;
      status:
        | "tracked"
        | "in_progress"
        | "awaiting_info"
        | "awaiting_approval"
        | "submitted"
        | "renewed"
        | "failed";
    }> = [
      {
        type: "Food Handler Permit",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/food-handler",
        deadline: now + 3 * DAY, // due soon (red)
        status: "tracked",
      },
      {
        type: "Business License",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/business-license",
        deadline: now + 12 * DAY, // amber
        status: "tracked",
      },
      {
        type: "Fire Safety Inspection",
        agency: "Springfield Fire Dept",
        portalUrl: "/demo-portal/fire-safety",
        deadline: now + 45 * DAY, // neutral
        status: "tracked",
      },
      {
        type: "Sign Permit",
        agency: "Springfield City Permits",
        portalUrl: "/demo-portal/sign",
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
