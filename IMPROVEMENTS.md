# Permitly — Improvements & Audit Reference

> Audit date: 2026-09-16. Source: SPEC.md, DESIGN.md, ../idea-scorecard.md,
> ../hackathonSetup.md, and a full read of convex/ + src/. This file is the
> reference point for the pre-submission hardening pass. Check items off as done.

## Why these changes

The idea is validated and uncontested (see `../idea-scorecard.md`): across ~200
hackathon apps, nobody uses Firecrawl `/interact` to fill AND submit a real web
form with a human approving each action. That is the moat. But the top entries
(Overlap, FetchBack) clear a craft bar this app did not yet meet: tests,
server-side validation of every AI/real action, verified webhooks, and a
bulletproof no-account demo. These changes close that gap without changing the
idea.

## Priority order

Correctness/security first (a judge reading the code or a misrouted reply exposes
these), then tests, then deploy, then demo polish.

---

## 1. Reply routing by threadId + fix the email-approve path  [CORRECTNESS]

**Problem.** `http.ts` routed every inbound email to `findAwaitingCase`, which
returned the newest case in state `awaiting_info` only — ignoring `threadId`
despite the `by_thread` index existing. Two consequences:

- With more than one open case, replies route to the wrong case.
- The "approve" email path only fired for `awaiting_info` cases, but approval
  happens in `awaiting_approval`. So **replying "approve" by email did nothing** —
  the documented email-approve path was broken.

**Also found.** The missing field the owner supplies by email (`renewalTerm`) was
recorded as a turn and then **discarded** — never written to the business
profile — so the "email us the missing detail" loop didn't actually capture the
detail. Submit hard-coded `2-year` to paper over it.

**Fix.**
- Route inbound mail by `threadId` first (`by_thread` index), falling back to the
  newest open case only when no thread match (single-inbox demo).
- Detect "approve" against a case in `awaiting_approval`; route a missing-field
  answer against a case in `awaiting_info`.
- Persist the supplied value onto the business profile so submit uses the real
  answer instead of a hard-coded term.

## 2. Svix webhook signature verification  [SECURITY]

**Problem.** `/agentmail/webhook` accepted any POST. Anyone could inject a reply
or trigger an approval+submit. SPEC section 8 and the scorecard both call for a
Svix-verified webhook; the code had a "comes next" stub.

**Fix.** Verify the Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`)
using `AGENTMAIL_WEBHOOK_SECRET` before processing. Reject with 401 on failure.
If the secret is unset, log and skip verification (dev) but never in prod.

## 3. Server-side payload re-validation at submit  [SECURITY / craft]

**Problem.** SPEC section 8: "the server validates the action payload before it
executes." In practice `approve` only checked case state; `submit` re-filled and
submitted without confirming an approved `submit_form` action existed for the
case. The winning security pattern (Overlap) is "server validates every AI
proposal before it executes."

**Fix.** In `submit`, load the latest action for the case and refuse unless it is
`kind: "submit_form"` and `status: "approved"`. Mark it `executed` with the
confirmation. This makes the human-in-the-loop guarantee true server-side, not
just in the UI.

## 4. convex-test suite  [craft — biggest point gap]

**Problem.** Zero tests. Top entries shipped real suites; the scorecard lists
"tests + typecheck + build green" as the recurring craft bar.

**Fix.** Add `convex-test` + `vitest`. Cover the load-bearing guarantees:
- Approval gate: `submit` refuses when no approved action exists.
- Approval gate: `approve` only advances from `awaiting_approval`.
- State machine: `open` creates the 8-step plan and sets `in_progress`.
- Reply routing: an inbound reply on a thread routes to that thread's case.

## 5. Board query bounding  [craft — matches own SPEC]

**Problem.** `board` uses `.collect()` on permits + N+1 case lookups. Bounded in
practice, but SPEC section 5 says "Never `.collect()` an unbounded table," so a
Convex judge sees the banned pattern.

**Fix.** Bound with `.take(100)` and a comment that permits-per-business is small.

## 6. Deadline-watch cron  [autonomy beat + Convex depth]

**Problem.** SPEC sections 4 and 10 describe a deadline cron that auto-opens a
case; no `crons.ts` existed. Crons are core Convex and a strong "works while you
sleep" demo beat.

**Fix.** Add `convex/crons.ts`: daily, find permits whose deadline is within N
days and still `tracked`, and flag/open them. Keep it safe (no auto-submit; the
approval gate still stops before any real action).

## 7. Note the official-component decision in hackathon.md  [judge-facing]

**Problem.** Both official components were dropped (AgentMail component's lib
functions didn't resolve at runtime; the key was inbox-scoped). Legitimate, but
the scorecard lists "both official components used" as a signal. Silent omission
invites a question.

**Fix.** Add a short, honest note to `hackathon.md`: evaluated `@agentmail/convex`,
hit a runtime resolution bug (`agentmail.lib.createInbox` unresolved), chose the
direct v0 REST API for reliability and full control. Firecrawl called via v2 REST
for the same reason. Frames it as engineering judgment.

## 8. Live-view demo polish + no-account demo  [demo hero]

**Problem.** The one thing no other entry does — an agent physically filling and
submitting a form — must be the visual centerpiece. The live-view was a normal
panel. The seeded demo should show the problem in the first 5 seconds.

**Fix.** Enlarge the live-view panel (taller iframe, full width, clear framing).
Confirm `seed:demo` loads with an overdue permit (it does: "Sign Permit" -2 days,
"Food Handler" +3 days) so the board opens red.

---

## Deploy + submit checklist (owner-run; needs interactive confirm)

Not automated here because prod deploy needs interactive confirmation.

- [ ] `npm run build` green (tsc -b + vite build) and `npm run lint` clean.
- [ ] `npx vitest run` green.
- [ ] Deploy to prod `glad-bee-780` (`npm run deploy`).
- [ ] On prod: set env vars (`AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`,
      `FIRECRAWL_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
      `AWS_REGION`, `BEDROCK_MODEL_ID`, `PERMITLY_INBOX_ID`).
- [ ] Seed prod (`seed:demo`).
- [ ] Register AgentMail webhook -> `https://glad-bee-780.convex.site/agentmail/webhook`.
- [ ] Verify one full renewal live (fill -> email -> reply -> book -> approve -> submit).
- [ ] Record demo video (<3 min): board -> Renew -> live fill -> email -> reply ->
      book -> Approve -> confirmation. Live view is the hero.
- [ ] Public repo pushed; `hackathon.md` at root; live URL; video.
- [ ] Submit at vibeapps.dev with the AllGasHackathon tag.

## Status log

- [x] 1. Reply routing + email-approve + persist supplied field
- [x] 2. Svix signature verification
- [x] 3. Submit-time payload re-validation
- [x] 4. convex-test suite (11 tests, `npm test`)
- [x] 5. Board query bounding
- [x] 6. Deadline cron
- [x] 7. hackathon.md component note
- [x] 8. Live-view + demo polish
- [x] 9. Build/lint/test green — verified 2026-09-16 (build ✓, lint 0/0, tests 11/11)

Remaining is owner-run only: production deploy + set env vars + seed + register
webhook + record video + submit (see checklist above).
