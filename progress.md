# Permitly — Progress Log

> Convex All Gas Hackathon (Convex · OpenAI · Firecrawl · AgentMail).
> Deadline 2026-09-22 12:00 PM PT. This file captures what's built, what works,
> the problems we hit and how we solved them, and what's left for tomorrow.

## What Permitly is

An agent that renews a small business's recurring permits and licenses end to
end: it opens the official portal, fills the renewal form, books an inspection
slot when required, emails the owner for any missing detail, and — after the
owner approves — submits the renewal and records the confirmation number.
Human-in-the-loop: nothing is submitted without explicit approval.

Full pitch, data model, and demo script are in `SPEC.md`. The competitive
research and idea validation are in `../idea-scorecard.md`.

## Current status: DEPLOYED TO PRODUCTION + verified live end to end

Live at **https://glad-bee-780.convex.site** (prod `glad-bee-780`). The full
loop is verified on prod with a real email round-trip: the agent signs in to the
multi-page mock portal, navigates the dashboard, fills the form, emails the owner
for a missing field, books the inspection, and — after an emailed "approve" —
submits through a review/confirm page and records the confirmation. Human-in-the-
loop is enforced server-side; the AgentMail webhook is Svix-verified.

Since the original core: hardened correctness/security (thread-aware reply
routing, Svix verification, server-side approval gate, bounce filtering), added a
convex-test suite (11 tests) and a deadline cron, rebuilt the case view visuals
(state-aware live view, animated timeline with email cards, step progress, loud
approval), and made the mock portal a realistic multi-page flow driven by
natural-language navigation. See `hackathon.md`, `IMPROVEMENTS.md`, and
`DEMO_ENHANCEMENTS.md`.

Remaining: record the <3-min demo video, push a public repo, and submit at
vibeapps.dev with the AllGasHackathon tag.

## Stack / architecture (all four sponsors do real work)

- **Convex** — backend: schema, indexes, queries/mutations/actions, scheduler
  (drives Firecrawl bursts), HTTP actions (AgentMail webhook + the mock portal),
  static hosting component, reactive board. Deployments: dev `aware-puma-695`,
  prod `glad-bee-780` (prod not yet deployed to).
- **AgentMail** — the case inbox (the Permitly demo inbox). Called via the **direct
  v0 REST API** from Convex actions (see Problem 1). Inbound handled by a webhook
  HTTP action.
- **Firecrawl** — scrape + `/interact` (fill/submit forms, pick booking slots) +
  `interactCode` (deterministic Playwright reads). Called via direct v2 REST.
  Returns the interactive live-view URL embedded in the case UI.
- **OpenAI slot filled by AWS Bedrock Nova** — `amazon.nova-lite-v1:0` via a
  self-signed SigV4 Converse call from a Convex action (see Problem 3). Used for
  mapping the business profile onto form fields + flagging missing fields. No
  OpenAI credits and no Convex paid plan needed.

Flow: board "Renew" → runner scrapes portal → Nova maps profile→fields →
Firecrawl fills → emails owner for missing field → owner replies (webhook) →
books inspection (Firecrawl) → approval gate → owner approves (button or "approve"
email) → Firecrawl submits + reads confirmation → permit renewed + owner emailed.

## Key files

- `convex/schema.ts` — businesses, permits, cases, steps, turns, actions
- `convex/permits.ts` — board query, startRenewal (opens case + schedules runner)
- `convex/cases.ts` — case lifecycle, timeline query, approve gate
- `convex/runner.ts` — the orchestration: run (fill), handleReply (book + advance),
  submit (submit + confirmation)
- `convex/firecrawl.ts` — scrape / interact / interactCode / stopInteract
- `convex/email.ts` — AgentMail REST (createInbox/listInboxes/send)
- `convex/llm.ts` — Bedrock Nova SigV4 Converse (ping, fillFields)
- `convex/http.ts` — AgentMail webhook + serves the mock portal pages
- `convex/portalHtml.ts` — the mock government portal HTML (food-handler + booking)
- `convex/seed.ts` — demo business + permits; resetCases / reseed helpers
- `src/App.tsx`, `src/components/Board.tsx`, `src/components/CaseView.tsx` — UI
- `SPEC.md`, `DESIGN.md` (app), `../DESIGN.md` (canonical), `../govtdesign.md` (portal)

## Design

- **App** → `../DESIGN.md` "Timescale — engineering blueprint on graph paper":
  warm `#fafafa` paper + dot grid, Geist + Geist Mono, near-monochrome, Signal
  Orange `#ff5b29` for emphasis only, Chartreuse `#f5ff80` spotlight, hard offset
  shadow `5px 5px 0px #000`, pill buttons. Light only.
- **Mock government portal** → `../govtdesign.md` "Drizzle — rainwater terminal":
  cool `#f6f6f7`, Electric Cobalt `#3e7ff0` accent, Inter + JetBrains Mono, 1px
  Pebble borders (no shadows), 8px radius. Deliberately distinct from the app.

## Problems encountered and how we solved them

1. **`@agentmail/convex@0.1.0` component was broken.** Its client called
   `components.agentmail.lib.createInbox` etc., but those functions did not
   resolve at runtime ("Couldn't resolve agentmail.lib.createInbox"). Confirmed
   systemic (listInboxes failed the same way). **Fix:** dropped the component and
   call the AgentMail v0 REST API directly from Convex actions. More reliable,
   full control.

2. **AgentMail key is inbox-scoped, not org-scoped.** `createInbox` returns 403
   `missing_permission` (`inbox_create` denied). **Fix:** use the existing inbox
   the existing demo inbox (stored as `PERMITLY_INBOX_ID`). Fine for a single-inbox
   demo. Note: unverified AgentMail accounts can only send to the signup address
   until OTP verification — relevant if we demo a real outbound email.

3. **Bedrock SigV4 from Convex.** Convex runs in the cloud, so it can't use the
   local `~/.aws` `simi-ops` profile. **Fix:** set the simi-ops access key/secret
   as Convex env vars and hand-sign the Bedrock Converse request (no AWS SDK).
   First attempt 403'd on the signature — root cause: SigV4 (non-S3) URI-encodes
   the path a second time, so the model id's `:` must be `%253A` in the canonical
   request. Fixed by double-encoding the canonical path only.

4. **Firecrawl interact session expired before submit.** The runner stops the
   session after the missing-info email (sessions are ~10 min); by approval time
   the stored scrapeId is dead (410 "Browser session has been destroyed"). **Fix:**
   submit always starts a FRESH scrape session and re-fills before submitting.

5. **Confirmation number looked stale / unread.** Prompt-based reading + regex was
   flaky and a stale DB value confused testing. **Fix:** read `#conf-no` from the
   page deterministically with Firecrawl `interactCode` (Playwright `$eval`).
   Proven to return a fresh page value (e.g. FH-2026-471107).

6. **Wrong design used at first.** Built against a self-authored `permitly/DESIGN.md`
   and missed the real `../DESIGN.md` at the project root, plus `../govtdesign.md`
   for the portal. **Fix:** re-skinned the app to Timescale and the portal to
   Drizzle; `permitly/DESIGN.md` now points to the canonical file.

7. **TypeScript/tooling papercuts:** unused-import lints break the Vite build
   (`tsc -b`); `process` needs `@types/node` in `"use node"` files; circular type
   inference on `new AgentMail(..., { onMessageReceived: internal.email... })`
   needed an explicit `AgentMail` type annotation; the app tsconfig picks up node
   types via the convex import graph (added `"node"` to app types).

## Environment / secrets (all set on the DEV deployment via `npx convex env set`)

Names only (values never committed): `AGENTMAIL_API_KEY`, `FIRECRAWL_API_KEY`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID`,
`PERMITLY_INBOX_ID`. `CONVEX_SITE_URL` is built-in. `.env` (Firecrawl+AgentMail)
and `.env.local` (Convex) are gitignored.

## What's left (tomorrow)

1. **Deploy to production** (`npm run deploy`, needs interactive confirmation to
   push to prod `glad-bee-780`). Then on prod: set all env vars, seed demo data,
   register the AgentMail webhook to `https://glad-bee-780.convex.site/agentmail/webhook`,
   verify one full renewal live. Public URL: `https://glad-bee-780.convex.site`.
2. **Demo video** (<3 min): board → Renew → watch fill (live view) → email for
   missing field → reply → book inspection → Approve → submitted + confirmation.
3. **Submit** at https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit
   with the AllGasHackathon tag: public repo, hackathon.md at root, live URL, video.

Mobile: intentionally skipped — desktop-first tool.

## Demo reset

Run `seed:reseed` (full wipe + fresh seed) or `seed:resetCases` (clear cases only)
to get a clean board between demo runs.
