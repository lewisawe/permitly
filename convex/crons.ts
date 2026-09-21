import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

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

// Demo self-heal: periodically clear cases and re-arm the demo permits so the
// public VibeApps showcase never degrades as anonymous visitors run renewals
// (a judge who runs a permit to "renewed" would otherwise leave fewer
// actionable rows for the next visitor). Safe: resetCases only clears case data
// and flips non-failed permits back to "tracked"; it never touches businesses
// or the permit set.
crons.interval(
  "reset demo showcase",
  { hours: 3 },
  api.seed.resetCases,
  {},
);

export default crons;
