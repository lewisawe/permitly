# Hackathon log

- **Project:** Permitly
- **Event:** Convex All Gas Hackathon
- **What it does:** An agent that renews a small business's recurring permits and licenses: it finds each official portal, fills the renewal form, books the inspection slot when required, and emails the owner for missing info and for approval before every real submission.
- **Live app:** https://glad-bee-780.convex.site
- **Repo:** https://github.com/lewisawe/permitly
- **Frontend:** Convex static hosting
- **Convex deployment:** prod `glad-bee-780` (live); dev `aware-puma-695`
- **Components:** @convex-dev/static-hosting, @convex-dev/rate-limiter (AgentMail and Firecrawl are called via their official REST APIs from Convex actions, not their Convex components — see 2026-09-16)
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, scheduled functions, crons, file storage, realtime queries, static hosting
- **Auth:** Convex Auth (`@convex-dev/auth`, Anonymous provider); owner-scoped data with a shared demo fallback so judges open the live URL without an account
- **AI models:** amazon.nova-lite-v1:0 (AWS Bedrock, via Converse)
- **Started:** 2026-09-14T19:05:24Z
- **Last updated:** 2026-09-21T21:41:00Z

## Log

### 2026-09-14 - working tree
Chose the project (Permitly) after scanning the field and confirming no entry fills
and submits real web forms. Wrote the spec, scaffolded Vite + React +
Convex, and added the `businesses`/`permits` schema with indexes (`by_owner`,
`by_business`, `by_deadline`, `by_status`) plus a `health` query on a cloud dev
deployment. Convex features: schema, indexes, queries.

### 2026-09-14 - working tree
Proved all three sponsor integrations from Convex actions and built the core loop.
Starting a renewal opens a case and schedules a runner that scrapes the mock portal
(Firecrawl), maps the profile onto form fields (Bedrock Nova), fills each field
(Firecrawl `/interact`, capturing the live-view URL), emails the owner for the one
missing field (AgentMail), then stops at the human step. An owner reply advances the
case: it books an inspection slot when required and, on approval, submits and reads
the confirmation number. Convex features added: actions, HTTP actions, scheduled
functions (`convex/runner.ts`, `llm.ts`, `firecrawl.ts`, `email.ts`, `http.ts`,
`portalHtml.ts`, `src/components/CaseView.tsx`).

### 2026-09-16 - working tree — sponsor component decision (honest note)
Evaluated both official Convex components and chose to call the sponsor APIs directly.
The AgentMail component (`@agentmail/convex@0.1.0`) did not resolve its functions at
runtime, so we use the AgentMail v0 REST API from Convex actions (`convex/email.ts`).
Firecrawl is called via the v2 REST API (`convex/firecrawl.ts`) for `/interact` and
`interactCode`. Integrations are real; only the demo portal is a controlled mock. We
still use the official Convex Static Hosting component.

### 2026-09-16 - working tree — pre-submission hardening
Closed the gaps between SPEC and code. Human-in-the-loop is enforced server-side
(`runner.submit` refuses to act without an approved `submit_form` action). The
AgentMail webhook is Svix-verified. Reply routing is thread-aware (`by_thread`) and
email-approve fires from `awaiting_approval`. Owner answers persist to the profile.
Added a daily deadline cron and a `convex-test` suite. Convex features added: crons,
tests (`convex/crons.ts`, `permitly.test.ts`).

### 2026-09-16 - working tree — deployed to production
Deployed backend + static site to prod `glad-bee-780` (public URL:
https://glad-bee-780.convex.site). Set prod env vars, registered the Svix-verified
AgentMail webhook, and seeded the demo business + permits (owner email read from
`DEMO_OWNER_EMAIL`, never committed). Ran a full renewal on prod driven by real email
— fill → email for missing field → owner reply → book inspection → email approve →
server-side gate → submit → confirmation read → renewed. Also filtered delivery-failure
bounces so they aren't mis-parsed as replies.

### 2026-09-16 - working tree — demo visuals + multi-page portal
Made the case view a live control room: the Firecrawl live view is never blank, the
timeline animates turns and renders emails as in-app cards, the plan shows progress,
and the approval moment is loud. Rebuilt the mock portal as login → dashboard → form →
review/confirm; the agent signs in and navigates via natural-language interact with a
deterministic fallback on final submit. Credentials live in Convex env vars.

### 2026-09-16 - working tree — deeper Convex usage
Leaned into Convex depth. Added the Rate Limiter component (per-business cap on renewal
starts), file-storage receipts with a reactive download URL, and anonymous Convex Auth
with owner-scoping (server resolves the caller; shared demo fallback keeps the no-account
path). Convex features added: file storage, realtime queries, auth, rate-limiter
component.

### 2026-09-17 - working tree — all permits renewable + PDF receipts + review
Parameterized the portal by permit type so every permit renews end to end (not just Food
Handler); added `permits.portalSlug`. Upgraded the receipt to a real one-page PDF
(`pdf-lib`, server-side). A code-review pass fixed two HIGH bugs (profile/form field-name
mismatch; the no-missing-info path now proposes the submit action so Approve appears) and
made submit record an honest provisional confirmation when the page can't be read. Suite
at 13 tests. Shipped a product-polish pass (landing page, toast, skeletons, mobile).

### 2026-09-21 - bcee4d6 — live-site proof + showcase durability + prod redeploy
Added a **Live-Site Demo (automationexercise.com)** board row that drives a real
third-party site end to end using natural-language Firecrawl prompts only (no hardcoded
selectors), through the same server-side approval gate as the mock: register → fill a
multi-page address form → checkout → place order → read the live confirmation → store the
receipt. Framed honestly (mock is the trustworthy primary; live site proves the technique
generalizes; explicitly not a government portal). For anonymous judges: a relaxed
`startRenewalDemo` rate bucket for the shared demo business, a "Reset demo" button
(`seed:resetCases`), and a 3-hour self-heal reset cron. Redeployed functions + frontend to
prod `glad-bee-780` and reseeded; board shows all rows including the live-demo row
(`convex/runner.ts`, `seed.ts`, `permits.ts`, `crons.ts`, `cases.ts`,
`src/components/Board.tsx`). `npm run build` and `npm run lint` (0/0) green.
