# Permitly

**Forward one email. Your business permits renew themselves, book their own inspections, and never lapse — with you approving every real submission.**

Permitly is an AI agent that renews a small business's recurring permits and
licenses end to end. It signs in to the official portal, navigates to the right
permit, fills the renewal form, books an inspection slot when one is required,
emails the owner for any missing detail, and — after the owner approves —
submits the renewal and records the confirmation number. A human approves every
real-world action; nothing is submitted without explicit approval.

Built for the **Convex All Gas Hackathon** (Convex · OpenAI · Firecrawl · AgentMail).

- **Live app:** https://glad-bee-780.convex.site
- **Build log:** [`hackathon.md`](./hackathon.md)
- **Full spec:** [`SPEC.md`](./SPEC.md)

## Why it's different

Across the hackathon field, apps *read* the web (scrape/monitor) and *send*
email. Permitly is the one agent that **acts on the web on your behalf** — it
fills and submits a real multi-page form (login → dashboard → form → review →
confirm) — while a human approves each real action and Convex orchestrates the
durable, multi-turn state.

## How it works

```
Board "Renew" (or an inbound email)
  -> open a case + schedule the runner (Convex scheduler)
  -> Firecrawl: sign in, navigate the dashboard, open the renewal form
  -> Bedrock Nova: map the business profile onto the form fields
  -> Firecrawl: fill each field on the live page (embedded live view)
  -> missing a field? AgentMail emails the owner; reply updates the case
  -> book the inspection slot if required (Firecrawl)
  -> approval gate: AgentMail emails a summary; owner replies "approve"
     (or clicks Approve on the board) — enforced server-side
  -> Firecrawl: submit through the review page; read the confirmation number
  -> permit marked renewed; owner emailed the confirmation
```

## The four sponsors (each does real work)

- **Convex** — the whole backend: schema, indexes, queries/mutations/actions,
  scheduler (Firecrawl bursts), HTTP actions (AgentMail webhook + the mock
  portal pages + auth routes), cron (deadline watch), file storage (receipts),
  anonymous auth with owner-scoping, reactive board, and two official components
  (static hosting + rate limiter).
- **Firecrawl** — `scrape` + `/interact` to sign in, navigate, fill and submit
  forms and pick booking slots; `interactCode` for deterministic reads. Returns
  the interactive live-view URL embedded in the case UI.
- **AgentMail** — the case inbox. Owner emails in; the agent emails out on the
  thread for missing info and approval. Inbound handled by a Svix-verified
  webhook.
- **AWS Bedrock Nova** (`amazon.nova-lite-v1:0`) — maps the stored business
  profile onto the form's fields and flags missing ones. (Fills the "OpenAI"
  slot; called via a SigV4-signed Converse request from a Convex action.)

## Human-in-the-loop & safety

- No submission or booking confirm without explicit approval (email "approve" or
  the board button). Enforced **server-side** in a Convex action — the client
  cannot bypass it.
- **Owner-scoped:** anonymous auth gives every visitor an identity; the server
  resolves the caller and `startRenewal` refuses without one (no cross-tenant
  writes). A shared demo business is the fallback so judges open the URL with no
  account.
- **Rate-limited:** renewal starts are capped per business (Firecrawl actions
  cost credits) via the rate-limiter component.
- The AgentMail webhook is **Svix-verified**; unsigned requests are rejected.
- Bounce/delivery-failure emails are ignored (never parsed as an owner reply).
- All secrets live in Convex env vars; no real PII in the repo (the demo owner
  email and portal credentials are env vars, and the target portal is a
  controlled mock clearly labeled DEMO).

## The demo portal

The target is a realistic, controlled mock of "Springfield City Permits" served
from the same Convex site (`/demo-portal/login` → `/dashboard` → `/food-handler`
→ `/review`, plus a `/booking` page), clearly labeled DEMO. The Firecrawl /
AgentMail / Bedrock calls are all real; only the portal is controlled, so the
demo doesn't flake on CAPTCHA/MFA. This mirrors how the strongest prior
hackathon entries demoed. Permitly does **not** claim to work on any arbitrary
government site — real portals add CAPTCHA, MFA, and anti-bot measures — but the
automation (sign-in, navigation, form-fill, submit) is genuine and adaptable.

## Tech stack

Vite + React + TypeScript frontend, Convex backend, deployed to `convex.site`
static hosting. Design system: "Timescale" (warm graph-paper) for the app,
"Drizzle" (cool cobalt) for the mock gov portal.

## Develop

```bash
npm install
npx convex dev      # dev backend (deployment: aware-puma-695)
npm run dev         # Vite dev server
```

Verify:

```bash
npm run build       # tsc -b + vite build
npm run lint        # oxlint
npm test            # vitest (convex-test suite)
```

Deploy (production push is interactive):

```bash
npm run deploy      # builds + deploys backend and static site to convex.site
```

### Required environment variables (set on the Convex deployment)

Names only — values are never committed:

`AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID`,
`PERMITLY_INBOX_ID`, `DEMO_OWNER_EMAIL`, `DEMO_PORTAL_USER`, `DEMO_PORTAL_PASS`,
`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` (auth — set by `npx @convex-dev/auth`).
`CONVEX_SITE_URL` is built in.

## Demo reset

```bash
npx convex run --prod seed:reseed     # full wipe + fresh seed (clean board)
npx convex run --prod seed:resetCases # clear cases only, keep permits
```

## Repo map

| Path | What |
|------|------|
| `convex/schema.ts` | businesses, permits, cases, steps, turns, actions |
| `convex/permits.ts` | board query, startRenewal, deadline-watch cron target |
| `convex/cases.ts` | case lifecycle, timeline query, approval gate, reply routing |
| `convex/runner.ts` | orchestration: sign-in + navigate + fill, handleReply, submit |
| `convex/firecrawl.ts` | scrape / interact / interactCode / stopInteract |
| `convex/email.ts` | AgentMail REST (send) |
| `convex/llm.ts` | Bedrock Nova SigV4 Converse (fillFields) |
| `convex/http.ts` | AgentMail webhook (Svix-verified) + mock portal pages |
| `convex/portalHtml.ts` | the mock portal HTML (login/dashboard/form/review/booking) |
| `convex/crons.ts` | daily deadline watch |
| `convex/auth.ts` / `auth.config.ts` | Convex Auth (anonymous provider) |
| `convex/seed.ts` | demo business + permits; reseed / resetCases |
| `convex/permitly.test.ts` | convex-test suite (approval gate, state machine, routing) |
| `src/components/Board.tsx` | compliance board |
| `src/components/CaseView.tsx` | case timeline, step progress, live view, approval bar |

## Reference docs

- [`SPEC.md`](./SPEC.md) — architecture, data model, state machine, demo script
- [`IMPROVEMENTS.md`](./IMPROVEMENTS.md) — pre-submission hardening audit + fixes
- [`DEMO_ENHANCEMENTS.md`](./DEMO_ENHANCEMENTS.md) — visual + multi-page portal plan
- [`CONVEX_DEPTH.md`](./CONVEX_DEPTH.md) — Convex depth additions (components, file storage, auth)
- [`DESIGN.md`](./DESIGN.md) — how the design system maps into the app
