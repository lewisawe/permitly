# Permitly — Demo Enhancements Plan (Phase 1 + Phase 2)

> Goal: make the app visually demonstrate its real capabilities, and prove it
> would work against a realistic multi-page portal (login -> navigate -> fill ->
> confirm), not just a single hard-coded form. Reference point for the build.
> Design system unchanged: "Timescale" for the app, "Drizzle" for the gov portal.

## Guiding principle

The most convincing, hardest-to-fake visual is the browser physically filling a
form live (Firecrawl live view). Everything else supports that. Phase 2's
credibility depends on the agent NAVIGATING pages via natural-language interact
(the genuine capability), not replaying hard-coded selectors we pre-wired.

Honest claim to judges: the automation is real (logs in, navigates, reads/fills
forms it wasn't tuned for); the target is a controlled mock so the demo doesn't
flake on CAPTCHA/MFA — same approach as the top prior entries. We do NOT claim it
works on any arbitrary .gov site.

---

## PHASE 1 — High-impact visuals (low risk, no backend change)

Files: `src/components/CaseView.tsx`, `src/components/Board.tsx`, `src/App.css`.
No schema/function changes. Safe.

### 1. Live-view is never blank (state-tied messaging)
- Between Firecrawl bursts the iframe is empty; that reads as broken.
- Show a state-aware panel driven by `case.state`:
  - `finding_page` / `reading_form` / `filling_form` -> "Agent is on the portal…" + live view if `liveViewUrl` present.
  - `awaiting_info` -> "Paused — waiting for the owner's email reply." (this IS the human-in-the-loop story)
  - `booking_slot` -> "Agent is booking the inspection…"
  - `awaiting_approval` -> "Ready to submit — waiting for your approval."
  - `submitting` -> "Agent is submitting the renewal…"
  - `done` -> success state with confirmation number.
  - `blocked` -> the error, calmly.
- When `liveViewUrl` exists, always render it; when not, show the labeled paused
  state instead of an empty frame.

### 2. Animated reactive timeline + in-app email cards
- New turns fade/slide in as Convex pushes them (respect `prefers-reduced-motion`).
- Per-direction styling: outbound email (orange), inbound reply (carbon),
  system/agent action (steel), approval (chartreuse).
- Render outbound/inbound turns that are emails as small "email cards"
  (from/subject-ish line + body preview) so the email round-trip is visible
  in-app without cutting to Gmail.

### 3. Step-progress indicator
- Header on the case view: "Step N of 8" + a progress bar that fills as steps
  complete (carbon fill on the graph-paper track).
- Running step pulses; done steps get a check; blocked step in signal orange.

### 4. "Needs you" is loud
- Case view: approval bar gets a subtle chartreuse glow/pulse when
  `awaiting_approval`.
- Board: rows whose case is `awaiting_info`/`awaiting_approval` get a left
  chartreuse marker + slightly stronger emphasis so "needs you" pops.
- Respect reduced-motion (no pulsing then; keep the static emphasis).

---

## PHASE 2 — Realistic multi-page portal + real navigation (higher risk)

Files: `convex/portalHtml.ts` (new pages), `convex/http.ts` (routes),
`convex/runner.ts` (login + navigation), `convex/seed.ts` (portal entry URL),
maybe `convex/firecrawl.ts` (helpers). Backend + AI-reliability variance.

### 5. Multi-page portal (Drizzle styling, DEMO-labeled)
New pages served from convex.site HTTP actions:
- **/demo-portal/login** — username + password + "Sign in". Lands on the
  dashboard. (Demo creds shown on the page as a hint, e.g. demo/demo, so it's
  honestly reproducible.)
- **/demo-portal/dashboard** — lists several permits (Food Handler, Business
  License, …) each with a "Renew" link to the form. Forces the agent to FIND the
  right one and click through — proves navigation, not just form-fill.
- **/demo-portal/food-handler** — existing renewal form (keep).
- **/demo-portal/review** — a confirm/review page showing entered values + a
  final "Confirm & submit" button, so it's a real multi-step wizard and the
  human-approval gate sits before the final confirm.
- Booking page stays as-is.

Keep: DEMO banner, gov styling, deterministic-enough behavior, confirmation
number generation.

### 6. Drive login + navigation via natural-language interact
- `runner.run` new flow:
  1. Scrape `/demo-portal/login` (entry URL).
  2. Interact (natural language): "Enter the username <u> and password <p>, then
     click Sign in." Creds from env (`DEMO_PORTAL_USER`/`DEMO_PORTAL_PASS`) so
     nothing real is committed.
  3. On the dashboard: "Find the Food Handler Permit row and click its Renew
     link." (navigation via understanding, not a hard-coded selector)
  4. On the form: fill via natural-language interact (already the real path).
  5. Missing-field email as today.
- `runner.submit` after approval:
  - Re-scrape entry, log in, navigate to the form, fill, click "Continue" to the
    **review page**, then click "Confirm & submit".
  - PRIMARY: natural-language interact for each step (honest/adaptable).
  - FALLBACK: if the natural-language submit doesn't reach a confirmation within
    a short retry, fall back to deterministic selectors (reliability for the
    live demo). Keep the confirmation read (`interactCode` on `#conf-no`).
- Seed: change the permit `portalUrl` entry point to `/demo-portal/login` (or add
  a `loginUrl`), so a renewal starts at the login page like a real portal.

Risk notes:
- Natural-language navigation can misfire (AI reliability). The selector fallback
  on the final submit keeps the demo safe.
- Firecrawl sessions ~10 min: login+nav+fill must fit in one burst; submit starts
  fresh and re-navigates (already the pattern).
- More pages = more can go wrong live; the fallback + a pre-staged case mitigate.

---

## Verification (task 7)

- `npm run build` (tsc -b + vite build), `npm run lint`, `npm test` all green.
- Deploy to prod (interactive confirm), reseed, run a live trigger and confirm
  the agent logs in, navigates the dashboard, fills, and (after approval) steps
  through the review page to submit — watch it in the live view.
- Update `hackathon.md` if behavior/URLs change.

## Status
- [x] 1. Live-view state messaging
- [x] 2. Animated timeline + email cards
- [x] 3. Step-progress indicator
- [x] 4. Loud "needs you" (case + board)
- [x] 5. Multi-page portal (login/dashboard/review)
- [x] 6. NL login + navigation, selector fallback on submit
- [x] 7. Build/lint/test green, deployed, live-verified on prod

## Prod verification (2026-09-16)

Deployed to `glad-bee-780` and ran a full live renewal. The agent:
1. Opened `/demo-portal/login` and **signed in** (natural-language interact).
2. **Navigated the dashboard** and clicked Renew on the Food Handler Permit.
3. Filled the form; emailed the owner for the missing renewal term.
4. Owner replied by email; agent recorded it and **booked the inspection**
   (INSP-2026-6780).
5. Owner replied "approve"; server-side gate ran; agent re-entered the portal,
   navigated to the form, filled it, stepped through the **review page**, and
   confirmed — capturing a fresh confirmation (FH-2026-826637).
6. Permit renewed; action recorded `executed` (approvedBy "owner (email)").

Verified: `npx convex codegen`, `npm run build`, `npm run lint` (0/0),
`npm test` (11/11) all green. All 5 portal routes return 200 on prod.

Note: the review page now generates a unique confirmation number each run
(fixes the earlier repeated-number issue). Demo tip: reply with the exact term
`1-year` or `2-year` (hyphen) so it matches the form's select; other phrasing
falls back to `2-year` via the submit guard.
