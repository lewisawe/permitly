import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Deadline watch: once a day, open renewal cases for permits due within a week.
// The approval gate still stops before any real submission, so this is safe to
// run unattended — it just makes sure nothing lapses because no one clicked
// "Renew" in time. (SPEC sections 4 and 10.)
const crons = cronJobs();

crons.daily(
  "watch permit deadlines",
  { hourUTC: 13, minuteUTC: 0 }, // ~6am PT
  internal.permits.watchDeadlines,
  { withinDays: 7 },
);

export default crons;
