import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Permitly schema. See SPEC.md section 5 and section 6 (state machine).

// Permit lifecycle status (shown on the board).
export const permitStatus = v.union(
  v.literal("tracked"),
  v.literal("in_progress"),
  v.literal("awaiting_info"),
  v.literal("awaiting_approval"),
  v.literal("submitted"),
  v.literal("renewed"),
  v.literal("failed"),
);

// Case state machine (SPEC section 6).
export const caseState = v.union(
  v.literal("intake"),
  v.literal("planning"),
  v.literal("finding_page"),
  v.literal("reading_form"),
  v.literal("filling_form"),
  v.literal("awaiting_info"),
  v.literal("booking_slot"),
  v.literal("awaiting_approval"),
  v.literal("submitting"),
  v.literal("recording"),
  v.literal("done"),
  v.literal("blocked"),
);

export const stepKind = v.union(
  v.literal("find_page"),
  v.literal("read_form"),
  v.literal("fill_form"),
  v.literal("book_slot"),
  v.literal("request_info"),
  v.literal("await_approval"),
  v.literal("submit"),
  v.literal("record_receipt"),
);

export const stepStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("done"),
  v.literal("blocked"),
);

export default defineSchema({
  businesses: defineTable({
    name: v.string(),
    ownerEmail: v.string(),
    // Free-form profile values used to fill permit forms (address, contact, ids).
    profile: v.record(v.string(), v.string()),
  }).index("by_owner", ["ownerEmail"]),

  permits: defineTable({
    businessId: v.id("businesses"),
    type: v.string(), // e.g. "food-handler"
    agency: v.string(), // e.g. "Springfield City Permits"
    portalUrl: v.string(),
    deadline: v.number(), // ms since epoch
    status: permitStatus,
    lastConfirmation: v.optional(v.string()),
    // If true, the renewal also requires booking an inspection appointment.
    requiresInspection: v.optional(v.boolean()),
    bookingUrl: v.optional(v.string()),
    bookingReference: v.optional(v.string()),
  })
    .index("by_business", ["businessId"])
    .index("by_deadline", ["deadline"])
    .index("by_status", ["status"]),

  // One active renewal run for a permit.
  cases: defineTable({
    permitId: v.id("permits"),
    businessId: v.id("businesses"),
    threadId: v.optional(v.string()), // AgentMail thread
    inboxId: v.optional(v.string()),
    state: caseState,
    currentStepId: v.optional(v.id("steps")),
    liveViewUrl: v.optional(v.string()), // Firecrawl interactive live view
    scrapeId: v.optional(v.string()), // Firecrawl session
    lastError: v.optional(v.string()),
    // The profile field the case is currently waiting on the owner to supply
    // (set when we email for a missing field; consumed when they reply).
    awaitingField: v.optional(v.string()),
  })
    .index("by_permit", ["permitId"])
    .index("by_state", ["state"])
    .index("by_thread", ["threadId"]),

  // The plan for a case (ordered steps).
  steps: defineTable({
    caseId: v.id("cases"),
    order: v.number(),
    kind: stepKind,
    status: stepStatus,
    detail: v.optional(v.string()),
    result: v.optional(v.string()),
  }).index("by_case_order", ["caseId", "order"]),

  // Every email/agent event on a case, for the timeline + audit.
  turns: defineTable({
    caseId: v.id("cases"),
    threadId: v.optional(v.string()),
    direction: v.union(
      v.literal("inbound"),
      v.literal("outbound"),
      v.literal("system"),
    ),
    summary: v.string(),
  }).index("by_case", ["caseId"]),

  // Every real-world action + its approval (human-in-the-loop gate).
  actions: defineTable({
    caseId: v.id("cases"),
    kind: v.union(v.literal("submit_form"), v.literal("confirm_booking")),
    payloadSummary: v.string(),
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("executed"),
    ),
    approvedBy: v.optional(v.string()),
    confirmation: v.optional(v.string()),
  })
    .index("by_case", ["caseId"])
    .index("by_status", ["status"]),
});
