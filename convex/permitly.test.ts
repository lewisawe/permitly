import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// convex-test needs the module map to find functions in this environment.
const modules = import.meta.glob("./**/*.ts");

// Helper: seed one business + one permit, return their ids.
async function seedPermit(
  t: ReturnType<typeof convexTest>,
  opts: { status?: string; deadline?: number } = {},
) {
  return await t.run(async (ctx) => {
    const businessId = await ctx.db.insert("businesses", {
      name: "Test Biz",
      ownerEmail: "owner@test.demo",
      profile: { legalName: "Test Biz LLC", address: "1 Main", contactName: "Sam" },
    });
    const permitId = await ctx.db.insert("permits", {
      businessId,
      type: "Food Handler Permit",
      agency: "Springfield City Permits",
      portalUrl: "/demo-portal/food-handler",
      deadline: opts.deadline ?? Date.now() + 3 * 86400000,
      status: (opts.status ?? "tracked") as any,
    });
    return { businessId, permitId };
  });
}

describe("case state machine", () => {
  test("open() creates the 8-step plan and marks the permit in_progress", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);

    const caseId = await t.mutation(api.cases.open, { permitId });

    const data = await t.query(api.cases.get, { caseId });
    expect(data).not.toBeNull();
    expect(data!.case.state).toBe("intake");
    expect(data!.steps).toHaveLength(8);
    // First step running, the rest pending.
    const sorted = data!.steps.sort((a, b) => a.order - b.order);
    expect(sorted[0].status).toBe("running");
    expect(sorted.slice(1).every((s) => s.status === "pending")).toBe(true);
    expect(data!.permit!.status).toBe("in_progress");
  });

  test("open() is idempotent per permit while a case is live", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const first = await t.mutation(api.cases.open, { permitId });
    const second = await t.mutation(api.cases.open, { permitId });
    expect(second).toBe(first);
  });
});

describe("approval gate", () => {
  test("approve() does nothing unless the case is awaiting_approval", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId }); // state: intake

    const res = await t.mutation(api.cases.approve, { caseId });
    expect(res.ok).toBe(false);

    // No action should have been approved, and no submit scheduled.
    const data = await t.query(api.cases.get, { caseId });
    expect(data!.actions.every((a) => a.status !== "approved")).toBe(true);
  });

  test("approve() from awaiting_approval marks the action approved", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId });

    // Move to the gate and propose a submit action (as the runner would).
    await t.mutation(api.cases.setState, { caseId, state: "awaiting_approval" });
    await t.mutation(internal.cases.proposeAction, {
      caseId,
      kind: "submit_form",
      payloadSummary: "Submit the Food Handler Permit renewal.",
    });

    const res = await t.mutation(api.cases.approve, {
      caseId,
      approvedBy: "tester",
    });
    expect(res.ok).toBe(true);

    const data = await t.query(api.cases.get, { caseId });
    const action = data!.actions.find((a) => a.kind === "submit_form");
    expect(action?.status).toBe("approved");
    expect(action?.approvedBy).toBe("tester");
  });

  test("latestAction reflects the newest proposed action for the case", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId });
    await t.mutation(internal.cases.proposeAction, {
      caseId,
      kind: "submit_form",
      payloadSummary: "first",
    });
    const latest = await t.run(async (ctx) =>
      ctx.runQuery(internal.cases.latestAction, { caseId }),
    );
    expect(latest?.kind).toBe("submit_form");
    expect(latest?.status).toBe("proposed");
  });
});

describe("inbound reply routing", () => {
  test("routeInbound prefers an exact threadId match", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, {
      permitId,
      threadId: "thread-123",
    });
    await t.mutation(api.cases.setState, { caseId, state: "awaiting_info" });

    const routed = await t.run(async (ctx) =>
      ctx.runQuery(internal.cases.routeInbound, { threadId: "thread-123" }),
    );
    expect(routed?._id).toBe(caseId);
  });

  test("routeInbound falls back to the newest waiting case when no thread match", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId });
    await t.mutation(api.cases.setState, { caseId, state: "awaiting_approval" });

    const routed = await t.run(async (ctx) =>
      ctx.runQuery(internal.cases.routeInbound, { threadId: undefined }),
    );
    expect(routed?._id).toBe(caseId);
  });
});

describe("owner-supplied field persistence", () => {
  test("applyOwnerAnswer writes the awaited field onto the business profile", async () => {
    const t = convexTest(schema, modules);
    const { businessId, permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId });

    // Runner sets which field it is waiting on, then the reply supplies it.
    await t.mutation(internal.cases.setAwaitingField, {
      caseId,
      field: "renewalTerm",
    });
    const applied = await t.mutation(internal.cases.applyOwnerAnswer, {
      caseId,
      value: "2-year",
    });
    expect(applied.field).toBe("renewalTerm");

    const profile = await t.run(async (ctx) => {
      const b = await ctx.db.get(businessId as Id<"businesses">);
      return b?.profile;
    });
    expect(profile?.renewalTerm).toBe("2-year");

    // The awaiting flag is cleared after applying.
    const data = await t.query(api.cases.get, { caseId });
    expect(data!.case.awaitingField).toBeUndefined();
  });

  test("applyOwnerAnswer is a no-op when nothing is awaited", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    const caseId = await t.mutation(api.cases.open, { permitId });
    const applied = await t.mutation(internal.cases.applyOwnerAnswer, {
      caseId,
      value: "ignored",
    });
    expect(applied.field).toBeNull();
  });
});

describe("deadline watch", () => {
  test("watchDeadlines opens a case for a tracked permit within the horizon", async () => {
    const t = convexTest(schema, modules);
    // Due in 2 days, still tracked -> should be picked up by a 7-day horizon.
    const { permitId } = await seedPermit(t, {
      status: "tracked",
      deadline: Date.now() + 2 * 86400000,
    });

    const res = await t.mutation(internal.permits.watchDeadlines, {
      withinDays: 7,
    });
    expect(res.opened).toBe(1);

    const openCase = await t.run(async (ctx) =>
      ctx.db
        .query("cases")
        .withIndex("by_permit", (q) => q.eq("permitId", permitId as Id<"permits">))
        .first(),
    );
    expect(openCase).not.toBeNull();

    // Let any scheduled runner bursts settle (they no-op without network here).
    await t.finishInProgressScheduledFunctions();
  });

  test("watchDeadlines skips permits that are not tracked", async () => {
    const t = convexTest(schema, modules);
    await seedPermit(t, { status: "renewed", deadline: Date.now() + 1 * 86400000 });
    const res = await t.mutation(internal.permits.watchDeadlines, { withinDays: 7 });
    expect(res.opened).toBe(0);
  });
});

describe("auth + rate limiting", () => {
  test("startRenewal refuses without an identity", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    await expect(t.mutation(api.permits.startRenewal, { permitId })).rejects.toThrow();
  });

  test("startRenewal throws once the per-business burst is exceeded", async () => {
    const t = convexTest(schema, modules);
    const { permitId } = await seedPermit(t);
    // Authenticated caller (anonymous identity). Bucket capacity 2; a rapid burst
    // trips the limit and throws. We don't finish scheduled functions here (the
    // runner is a Node action needing network).
    const asUser = t.withIdentity({ subject: "test-user|123", issuer: "test" });
    let threw = false;
    for (let i = 0; i < 6; i++) {
      try {
        await asUser.mutation(api.permits.startRenewal, { permitId });
      } catch {
        threw = true;
        break;
      }
    }
    expect(threw).toBe(true);
  });
});
