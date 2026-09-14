// Status + deadline display helpers (see DESIGN.md status colors).

export type PermitStatus =
  | "tracked"
  | "in_progress"
  | "awaiting_info"
  | "awaiting_approval"
  | "submitted"
  | "renewed"
  | "failed";

export const STATUS_LABEL: Record<PermitStatus, string> = {
  tracked: "Tracked",
  in_progress: "Agent working",
  awaiting_info: "Needs info",
  awaiting_approval: "Needs approval",
  submitted: "Submitted",
  renewed: "Renewed",
  failed: "Needs attention",
};

// Maps to CSS classes defined in App.css (.pill-<tone>).
export const STATUS_TONE: Record<PermitStatus, string> = {
  tracked: "neutral",
  in_progress: "info",
  awaiting_info: "warn",
  awaiting_approval: "warn",
  submitted: "info",
  renewed: "success",
  failed: "danger",
};

const DAY = 24 * 60 * 60 * 1000;

export function deadlineInfo(deadline: number): {
  label: string;
  urgency: "past" | "soon" | "near" | "far";
} {
  const now = Date.now();
  const diff = deadline - now;
  const days = Math.round(diff / DAY);
  if (diff < 0) {
    return { label: `${Math.abs(days)}d overdue`, urgency: "past" };
  }
  if (days <= 3) return { label: `Due in ${days}d`, urgency: "soon" };
  if (days <= 14) return { label: `Due in ${days}d`, urgency: "near" };
  const date = new Date(deadline).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { label: `Due ${date}`, urgency: "far" };
}
