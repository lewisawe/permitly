import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Permitly schema. See SPEC.md section 5.
// Minimal first cut: businesses + permits. Cases/steps/turns/actions land in a
// later commit alongside the state machine.
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
    status: v.union(
      v.literal("tracked"),
      v.literal("in_progress"),
      v.literal("awaiting_info"),
      v.literal("awaiting_approval"),
      v.literal("submitted"),
      v.literal("renewed"),
      v.literal("failed"),
    ),
    lastConfirmation: v.optional(v.string()),
  })
    .index("by_business", ["businessId"])
    .index("by_deadline", ["deadline"])
    .index("by_status", ["status"]),
});
