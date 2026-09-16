# Hackathon log

- **Project:** Permitly
- **Event:** Convex All Gas Hackathon
- **What it does:** An agent that renews a small business's recurring permits and licenses: it finds each official portal, fills the renewal form, books the inspection slot when required, and emails the owner for missing info and for approval before every real submission.
- **Live app:** https://glad-bee-780.convex.site
- **Repo:** https://github.com/lewisawe/permitly
- **Frontend:** Convex static hosting
- **Convex deployment:** prod `glad-bee-780` (live); dev `aware-puma-695`
- **Components:** Convex Static Hosting (`@convex-dev/static-hosting`) + Rate Limiter (`@convex-dev/rate-limiter`, caps renewal starts per business). AgentMail and Firecrawl are called via their official REST APIs from Convex actions rather than their Convex components — see the note below.
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, scheduled functions, cron jobs, file storage, real-time reactive queries, static hosting
- **Auth:** anonymous (Convex Auth `@convex-dev/auth`, Anonymous provider); data is owner-scoped, with a shared demo business fallback so judges open the live URL without an account
- **AI models:** amazon.nova-lite-v1:0 (AWS Bedrock, via Converse)
- **Started:** 2026-09-14T19:05:24Z
- **Last updated:** 2026-09-16T23:52:00Z

## Log

### 2026-09-14 - working tree
Set up the Convex development environment before writing any app code. Installed
the Convex agent skills and configured the Convex MCP server for the coding
agent. Added the hackathon build-log skill under
`.agents/skills/convex-hackathon-skill/`. No product code, schema, or Convex
functions exist yet.

### 2026-09-14 - working tree
Restarted the agent and confirmed the Convex MCP server is active: a status
check reached the server, which reported no logged-in Convex project yet (the
expected state before `npx convex dev`). Environment is ready for building.

### 2026-09-14 - working tree
Chose the project: Permitly, a permit/license renewal agent for small businesses,
after scanning the full field of hackathon submissions and confirming no entry
fills and submits real web forms on a user's behalf. Wrote SPEC.md (architecture,
data model, state machine, demo plan) and DESIGN.md (UI design system).

### 2026-09-14 - working tree
Scaffolded a Vite + React + TypeScript app and set up the Convex backend. Added
`convex/schema.ts` with `businesses` and `permits` tables and indexes
(`by_owner`, `by_business`, `by_deadline`, `by_status`), plus a `health` query.
Wired the React client with `ConvexProvider` and applied the design tokens.
Convex features so far: schema, indexes, queries (`convex/schema.ts`,
`convex/health.ts`, `src/main.tsx`, `src/App.tsx`). Provisioned a cloud dev
deployment and verified the `health` query runs on it. Not yet deployed publicly.

### 2026-09-14 - working tree
Proved all three sponsor integrations from Convex actions. AgentMail: reached the
account and listed the case inbox (direct v0 REST, after the @agentmail/convex
component's functions failed to resolve at runtime). Firecrawl: scraped a public
form and used `/interact` to fill a field, which returned an interactive
live-view URL for the demo. AWS Bedrock Nova Lite answered a Converse call and is
the chosen LLM (no OpenAI credits, no Convex paid plan). Built the compliance
board UI (verified with Playwright: 4 permits render with correct KPIs and
deadline colors) and a DEMO-labeled "Springfield City Permits" mock renewal form
for the agent to act on. Added Convex static hosting for the eventual
convex.site URL (`convex/http.ts`, `convex/email.ts`, `convex/firecrawl.ts`,
`src/App.tsx`, `public/demo-portal/food-handler.html`).

### 2026-09-14 - working tree
The core agent loop runs end to end. Starting a renewal from the board opens a
case and schedules a runner that: opens the mock Springfield City Permits portal
(Firecrawl scrape, served publicly from convex.site via an HTTP action), maps the
business profile onto the form fields with AWS Bedrock Nova, fills each field on
the live page with Firecrawl `/interact` (capturing the interactive live-view URL
that the case UI embeds), detects the one field the profile lacks (renewal term),
and emails the owner for it through AgentMail — then stops at the human step with
the permit marked "awaiting info". Convex features added: scheduled functions
(runner bursts), HTTP actions (portal + webhook). AI models: amazon.nova-lite-v1:0
via a self-signed SigV4 Bedrock Converse call (`convex/runner.ts`, `convex/llm.ts`,
`convex/firecrawl.ts`, `convex/email.ts`, `convex/http.ts`). Verified live: all
four steps completed, four activity turns logged, live-view captured.

### 2026-09-14 - working tree
Completed the full renewal loop and polished it. An owner reply now advances the
case through the human-approval gate to submission: the webhook routes an
"approve" reply or a missing-field answer, the agent books a fire-safety
inspection slot on a second mock portal page when the permit requires one
(Firecrawl picks a slot and captures the booking reference), and on approval the
agent submits the renewal and reads the confirmation number straight from the
page via a deterministic Firecrawl code run, then marks the permit renewed and
emails the owner. Added an in-app "Approve & submit" button on the case view.
Verified end to end on the dev deployment: inspection booked, renewal submitted,
a fresh page-read confirmation recorded, permit renewed
(`convex/runner.ts`, `convex/http.ts`, `convex/portalHtml.ts`, `convex/firecrawl.ts`,
`src/components/CaseView.tsx`).

### 2026-09-16 - working tree — sponsor component decision (honest note)

We evaluated both official Convex components and made a deliberate choice to call
the sponsor APIs directly instead:

- **AgentMail (`@agentmail/convex@0.1.0`):** its client resolved to
  `components.agentmail.lib.createInbox` (and siblings), which did not exist at
  runtime ("Couldn't resolve agentmail.lib.createInbox"); `listInboxes` failed the
  same way. We switched to the AgentMail **v0 REST API** from Convex actions
  (`convex/email.ts`) for reliability and full control over inbox scoping.
- **Firecrawl:** called via the **v2 REST API** (`convex/firecrawl.ts`) so we could
  use `/interact` (fill/submit/booking) and `interactCode` (deterministic
  Playwright reads) exactly as the demo needs.

The integrations are real and run on the deployment; only the demo *portal* is a
controlled mock. We still use the official **Convex Static Hosting** component.

### 2026-09-16 - working tree — pre-submission hardening pass

Closed the gaps between SPEC's promises and the code, guided by the craft bar in
`../idea-scorecard.md`:

- **Human-in-the-loop is now enforced server-side.** `runner.submit` refuses to do
  anything real unless an `approved` `submit_form` action exists for the case, and
  closes it out `executed` with the confirmation number. The client cannot bypass
  the gate.
- **Webhook is Svix-verified.** `/agentmail/webhook` verifies the Svix signature
  (HMAC-SHA256 over `id.timestamp.body`, 5-minute replay window) before trusting
  any inbound event; unsigned requests get 401.
- **Reply routing is thread-aware.** Inbound mail routes to the owning case by
  `threadId` (the `by_thread` index), with a newest-waiting fallback. Fixed the
  email "approve" path so it fires from `awaiting_approval` (previously it only
  matched `awaiting_info`, so email-approve was a no-op).
- **Owner answers persist.** A missing field supplied by email is now written to
  the business profile and used at submit (was recorded then discarded, with the
  renewal term hard-coded).
- **Deadline cron.** `convex/crons.ts` runs `permits.watchDeadlines` daily to open
  renewal cases for permits due within a week — nothing lapses unattended, and the
  approval gate still stops before any real submission.
- **Tests.** Added `convex-test` + `vitest` with 11 passing tests covering the
  approval gate, state machine, reply routing, field persistence, and the deadline
  watch (`convex/permitly.test.ts`, `npm test`).
- Bounded the board query (`.take(100)`), enlarged the live-view for the demo.

Verified: `npm run build` green, `npm run lint` 0/0, `npm test` 11/11.
Full findings and rationale: `IMPROVEMENTS.md`.

### 2026-09-16 - working tree — deployed to production + verified live end to end

Deployed the backend and static site to the prod deployment `glad-bee-780`.
Public URL judges can open without an invite: **https://glad-bee-780.convex.site**.

Set up prod: copied all deployment env vars from dev, created the AgentMail
`message.received` webhook pointed at
`https://glad-bee-780.convex.site/agentmail/webhook` (Svix secret stored as
`AGENTMAIL_WEBHOOK_SECRET`), and seeded the demo business + permits. The seed
reads the owner email from a `DEMO_OWNER_EMAIL` env var so no real address is
committed to the repo.

Ran a full renewal on prod, driven entirely by real email, and verified every
step live:

- Firecrawl opened the mock portal and filled 4 fields from the profile (mapped
  by Bedrock Nova); the interactive live-view URL was captured.
- The agent emailed the owner for the one missing field (renewal term) and paused
  at `awaiting_info`.
- The owner replied by email ("2-year"); the Svix-verified webhook routed the
  reply, the value was persisted to the profile, and Firecrawl booked the fire
  safety inspection (reference INSP-2026-9370).
- The agent emailed for approval and paused at `awaiting_approval`.
- The owner replied "approve" by email; the server-side gate ran, Firecrawl
  submitted the renewal, and the confirmation number was read from the page.
  The permit flipped to `renewed` and the action was recorded `executed`
  (approvedBy "owner (email)").

Also hardened during this pass: the webhook now ignores delivery-failure bounces
(an undeliverable send was previously mis-parsed as an owner reply). Deploy
blocker fixed: excluded `*.test.ts` from the Convex `tsc` typecheck
(`import.meta.glob` is a Vite construct; tests still run under vitest).

All four sponsors do real work on production; a human approved every real action.
Remaining before submission: record the <3-min demo video and submit at
vibeapps.dev with the AllGasHackathon tag. Reseed with `seed:reseed` for a clean
board before recording.

### 2026-09-16 - working tree — demo visuals + realistic multi-page portal

Two rounds of enhancement to demonstrate the capability, both deployed to prod
and verified live (plan + results in `DEMO_ENHANCEMENTS.md`).

Visuals (case view is now a live control-room): the Firecrawl live view is never
blank — it shows the real browser while the agent acts and a labeled status
otherwise (e.g. "Paused — waiting for your reply"); the activity timeline
animates new turns in and renders emails as in-app cards so the round-trip is
visible without leaving the app; the plan shows "N of 8" with a progress bar; the
approval moment is loud (pulsing chartreuse bar + a highlighted board row).

Realistic multi-page portal: the mock portal is now login -> dashboard -> form ->
review/confirm, not a single page. The agent **signs in and navigates** via
Firecrawl natural-language interact (it understands the page rather than
following hard-coded selectors), with a deterministic Playwright fallback on the
final submit for demo reliability. Demo credentials and the owner email are
Convex env vars (`DEMO_PORTAL_USER`/`DEMO_PORTAL_PASS`/`DEMO_OWNER_EMAIL`), never
committed. This answers "would it work on a real site?" — the sign-in,
navigation, form-fill and multi-step confirm are genuine; only the target is a
controlled mock.

Verified live on prod: a full renewal ran login -> dashboard -> fill -> email the
owner -> owner reply -> book inspection (INSP-2026-6780) -> email approve ->
submit through the review page -> fresh confirmation FH-2026-826637 -> renewed.
`npm run build`, `npm run lint` (0/0), `npm test` (11/11) green; all 5 portal
routes return 200 on prod. Wrote a proper `README.md` (replacing the Vite
boilerplate).

### 2026-09-16 - working tree — deeper Convex usage (components, file storage, auth)

Strengthened the "Convex depth" criterion (OpenAI is out — no credits — so we
leaned into Convex). Plan + status in `CONVEX_DEPTH.md`. All deployed to prod.

- **Rate Limiter component** (`@convex-dev/rate-limiter`): a per-business token
  bucket caps how often a renewal (a real, credit-costing Firecrawl web action)
  can be started; `startRenewal` throws a surfaced ConvexError when exceeded.
- **File storage**: on submit, a confirmation receipt is generated and stored via
  `ctx.storage`; `cases.receiptUrl` returns a reactive download URL and the case
  view shows a "Download receipt" button.
- **Live updates**: confirmed every read is a reactive `useQuery` (no polling);
  added a "Live" affordance on the board.
- **Anonymous auth + owner-scoping** (`@convex-dev/auth`, Anonymous provider):
  every visitor gets an identity on load (no account needed, so judges still open
  the live URL); data is owner-scoped and `startRenewal` requires an identity —
  the server resolves the caller (verified on prod: an unauthenticated
  `startRenewal` is refused). The board falls back to a shared demo business so a
  first-time visitor always sees a populated board.

Convex depth now: schema + indexes, queries, mutations, actions, HTTP actions,
scheduler, cron, file storage, real-time reactive queries, anonymous auth with
owner-scoping, and two official components (static-hosting + rate-limiter).
Verified: `npm run build`, `npm run lint` (0/0), `npm test` (13 tests) green;
prod board loads under anonymous auth; auth discovery endpoints live.
