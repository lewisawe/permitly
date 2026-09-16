# Permitly — Convex Depth Additions

> Goal: strengthen the hackathon's "Convex depth" criterion (real use of queries,
> mutations, live updates, auth, and components — not a thin frontend). OpenAI is
> out (no credits), so we lean into Convex. Reference point + status log. Micro
> commits after each item.

## Why (from the official criteria)
"Convex depth: Real use of queries, mutations, live updates, auth, and
components. A thin frontend on a hosted page does not count." We already have
schema/indexes, queries/mutations/actions, HTTP actions, scheduler, cron,
reactive board, and one component (static-hosting). The two named gaps are
**components** (use more) and **auth**. Add file storage + live-update framing
as extra real features.

## Additions (build order = lowest risk first)

### A. Rate Limiter component (`@convex-dev/rate-limiter`)  [low risk]
- Real component doing real work: cap how often a renewal can be started per
  business. Firecrawl `/interact` costs credits, so rate-limiting real web
  actions is a genuine, defensible use — not decoration.
- Install: `npm i @convex-dev/rate-limiter`; `app.use(rateLimiter)` in
  convex.config.ts; define a limit; call `rateLimiter.limit(ctx, name, {key})`
  in `permits.startRenewal`.
- Config: `startRenewal` token bucket, e.g. rate 5 / HOUR, capacity 2, key =
  businessId. On `!ok`, throw a ConvexError or return a limited result the UI
  shows ("You just started this renewal — try again in Nm").
- Risk: low. Isolated to startRenewal. Verify build + a test.

### B. File-storage receipts  [low-medium risk]
- On submit success, generate a plain-text receipt (business, permit, agency,
  confirmation #, booking ref, timestamp), store via `ctx.storage.store(Blob)`,
  save the returned storageId on the `actions` row (+ maybe permit).
- Add a query that returns `ctx.storage.getUrl(storageId)` so the UI shows a
  "Download receipt" button on a done case.
- Schema: add `receiptFileId: v.optional(v.id("_storage"))` to actions.
- Risk: low-medium. `ctx.storage.store` is available in actions; the submit
  runner is a "use node" action — confirm storage API works there (it does via
  ctx.storage). Verify a real store + getUrl.

### C. Live updates — surface + prove  [very low risk, mostly framing]
- We already have reactive queries (board + case). Make the demo show two
  surfaces updating at once (board KPI "Renewed" ticks up while the case flips to
  done). Add a small "live" affordance if useful (e.g. a subtle "updated just
  now"), but do not over-build. Mostly: verify no polling, everything via
  useQuery, and note it for the video.
- Risk: minimal.

### D. Anonymous auth + owner-scoping  [HIGHEST risk — do last, guarded]
- Convex Auth anonymous provider so each visitor gets an identity; scope
  businesses/permits/cases to the caller. Server resolves the caller (no query
  returns another owner's data) — the security pattern winners showed.
- MUST keep a no-account demo path: judges open the live URL without an invite.
  Anonymous auth satisfies this (auto identity on load), and we seed the demo
  business for the anonymous user (or a shared demo owner) so the board isn't
  empty.
- Touches: auth.config.ts, ConvexAuthProvider in main.tsx, every board/case
  query + startRenewal (scope by identity), seed (attach to the demo identity),
  and the convex-test suite (withIdentity).
- Risk: HIGH this close to deadline. If it destabilizes the verified demo, we
  ship without it and keep the honest "anonymous owner identity" note. Decide
  after A–C are done and committed, so we always have a working fallback.

## Verification & deploy
- After EACH item: `npm run build`, `npm run lint`, `npm test` green; micro commit.
- Update convex-test for new behavior (rate limit, receipt, auth scoping).
- Deploy to prod (interactive) once the batch is stable; reseed; live-verify.
- Update hackathon.md (Components: + rate-limiter; Auth: anonymous; Convex
  features: + file storage), README, progress.md.

## Status
- [ ] 1. Plan (this doc)

## Revert point (before the risky auth work)
Last-known-good commit with items A–C green and demo-parity:
**`063303a`** — "feat: surface real-time updates with a Live indicator on the board".
If Convex Auth (item D) destabilizes the verified demo:
`git reset --hard 063303a && npm install`, then redeploy. A–C are preserved.

- [ ] A. Rate Limiter component
- [ ] B. File-storage receipts
- [ ] C. Live updates surfaced/verified
- [ ] D. Anonymous auth + owner-scoping (guarded)
- [ ] E. Verify + deploy + docs
