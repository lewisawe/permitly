# Hackathon log

- **Project:** Permitly
- **Event:** Convex All Gas Hackathon
- **What it does:** An agent that renews a small business's recurring permits and licenses: it finds each official portal, fills the renewal form, books the inspection slot when required, and emails the owner for missing info and for approval before every real submission.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, scheduled functions, static hosting
- **Auth:** none
- **AI models:** amazon.nova-lite-v1:0 (AWS Bedrock, via Converse)
- **Started:** 2026-09-14T19:05:24Z
- **Last updated:** 2026-09-14T20:35:00Z

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
