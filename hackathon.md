# Hackathon log

- **Project:** Permitly
- **Event:** Convex All Gas Hackathon
- **What it does:** An agent that renews a small business's recurring permits and licenses: it finds each official portal, fills the renewal form, books the inspection slot when required, and emails the owner for missing info and for approval before every real submission.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, indexes, queries
- **Auth:** none
- **AI models:** none
- **Started:** 2026-09-14T19:05:24Z
- **Last updated:** 2026-09-14T19:58:00Z

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
