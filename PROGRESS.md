# Permitly — work log (resume here)

> Last session: 2026-09-19. Hackathon deadline: **Mon/Tue Sep 22, 12pm PT**.
> Dev deployment: `aware-puma-695`. All work below is on **DEV ONLY — not pushed to prod.**

## The goal we set

Take the calibrated "big risk": prove Permitly's automation on a **real
third-party live site** (not just our own mock HTML), while keeping the
controlled mock as the reliable primary demo. Then make the app durable and
safe as a **self-serve VibeApps showcase** for anonymous judges.

Track B target chosen: **automationexercise.com** (built for automation
practice, no CAPTCHA/MFA, has a real register -> checkout -> "Order Placed"
multi-page flow). Not a government portal, and we never claim it is.

---

## What we built + VERIFIED today

### 1. Real-site proof path (Track A) — WORKS end to end (verified twice)

The board has a **Live-Site Demo (automationexercise.com)** row. Clicking it
drives the real site end to end using **only natural-language Firecrawl
`/interact` prompts (no hardcoded CSS selectors)**, through the **same
server-side approval gate** as the mock:

- `realProofPrep`: open -> register a throwaway account (`permitly.demo+<ts>@example.com`)
  with address details -> add an item -> reach the checkout review page -> STOP,
  propose the action, email for approval.
- `realProofSubmit`: log back in with the throwaway creds -> cart -> checkout ->
  place order -> fill dummy card (`4111111111111111`, sandbox) -> Pay and Confirm
  -> **read the live confirmation via NL** ("Congratulations! Your order has been
  confirmed!") -> store receipt PDF -> mark executed.

Verified result (twice, on cleaned code): case `done`, action `executed`,
`confirmedReal = true`, confirmation "ORDER PLACED (live site)", receipt stored.

**Root cause we fixed:** the submit-phase checkout was one combined multi-hop NL
prompt (cart->checkout->place order->payment) which stalled and returned empty
output, so it recorded a provisional number. Split into **discrete single-goal
`interact()` calls** (open cart / proceed to checkout / place order / fill card /
pay and confirm). After the fix the live confirmation reads correctly.

### 2. Showcase durability + safety for anonymous judges — VERIFIED

- **Signposted the live row**: "Live external site · ~2 min" badge (Globe icon),
  button relabeled "Run live demo" with an explanatory tooltip. Fast mock rows
  stay instant/unlabeled so the slower live run isn't mistaken for frozen.
- **Relaxed rate limit for the shared demo business**: new `startRenewalDemo`
  bucket (30/min, capacity 20) vs tight `startRenewal` (3/min, capacity 2).
  `isDemoBusiness(ownerEmail)` compares to `DEMO_OWNER_EMAIL`. Verified
  `DEMO_OWNER_EMAIL=lewisbet9@gmail.com` matches the seeded business, so
  concurrent judges get the generous bucket (still bounded vs credit abuse).
- **"Reset demo" button** on the board (calls `seed:resetCases`), re-arms all
  non-failed permits back to `tracked`, clears cases, strips leftover throwaway
  creds. Verified: renewed->tracked, cases cleared, `failed` Sign Permit kept.
- **Self-heal cron**: `crons.ts` interval "reset demo showcase" every 3h calls
  `api.seed.resetCases` so the board recovers even if nobody clicks Reset.

### 3. Framing (honest, tiered)

- `README.md`: "Live-site proof" section — mock is trustworthy primary; live site
  is proof the technique generalizes; explicitly NOT a gov portal; dummy card on
  sandbox; shared human-in-the-loop gate.
- `SPEC.md` section 11: added an optional ~25s closing demo beat AFTER the mock
  flow, with a note to **record it as backup** (live site is a network dependency).

---

## Files changed (all on dev, not prod)

| File | Change |
|------|--------|
| `convex/runner.ts` | `isExternalTarget()` router; `run`/`submit` branch to NL-only `realProofPrep`/`realProofSubmit` for external URLs (mock path untouched). Discrete-step checkout in submit. Throwaway creds stashed on `business.profile` under `_rpEmail`/`_rpPass`/`_rpName`. |
| `convex/cases.ts` | added internal `setProfileValues` mutation (merge values into `business.profile`). |
| `convex/seed.ts` | added "Live-Site Demo (automationexercise.com)" board row (`portalSlug: "live-demo"`, external `portalUrl`). Hardened `resetCases` to re-arm non-failed permits + strip throwaway creds. |
| `convex/permits.ts` | `startRenewalDemo` rate bucket + `isDemoBusiness()`; `startRenewal` picks bucket by business. |
| `convex/crons.ts` | added 3-hour "reset demo showcase" cron. |
| `src/components/Board.tsx` | live-row signpost badge + "Run live demo" label; "Reset demo" button + handler. |
| `src/App.css` | `.board-head` flex; `.reset-demo-btn`, `.live-badge`; `.cell-type` flex-column. |

## Verification status

- `npm run build` (tsc + vite): PASS
- `npm run lint` (oxlint): 0 warnings / 0 errors
- Live real-site run: PASS x2 (case done, action executed, real confirmation read)
- Mock run: PASS (awaiting_approval -> approve -> done)
- Reset: PASS (board re-armed)
- Board left clean for next session.

---

## TODO tomorrow (pick up here)

1. **Click-test in a real browser** (the one path not CLI-testable): open the app,
   confirm anonymous auth issues an identity, click "Renew" on a mock row ->
   approval bar shows -> Approve -> done. Then click "Run live demo" and watch the
   live-view iframe. Confirm the rate-limit relaxation works under real clicks.
2. **Record the backup demo video**, especially the live-site beat (network dep).
3. **Decide on prod deploy**: `npm run deploy` when ready (interactive). Nothing
   above is on prod yet.
4. **(Optional, pre-existing, out of scope so far)** Mock submit sometimes records
   a *provisional* confirmation ("couldn't read a confirmation from the page") via
   its `#conf-no` `interactCode` read — still reaches `done`. If we want the mock
   confirmation to read reliably every time, that's a small separate fix.
5. **Submission checklist** (SPEC section 12): public repo, hackathon.md at root,
   live convex.site URL, <=3min video, AllGasHackathon tag on vibeapps.dev.

## Handy commands

```bash
npx convex dev --once            # push functions to dev (aware-puma-695)
npm run build && npm run lint    # verify
npx convex run seed:reseed       # full wipe + fresh seed (adds live-demo row)
npx convex run seed:resetCases   # clear cases + re-arm board (the Reset button)
npm run dev                      # Vite dev server for the browser click-test
npm run deploy                   # build + deploy to prod (interactive) — WHEN READY
```

Live app: https://glad-bee-780.convex.site
