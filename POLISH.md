# Permitly — Product Polish Plan (2-day pass)

> Goal: make Permitly feel like a shipped product, not a hackathon demo. The
> design system (Timescale) is already coherent — this pass fills completeness
> gaps (states, chrome, micro-interactions, meta), it does NOT restyle what works.
> Video is recorded on the weekend, so polish the surfaces the camera sees:
> board + case view. Micro commits after each item. Keep build/lint/test green.

## Principles
- Don't touch the color/type system or the two-design-system split (app vs portal).
- Motion tracks real events; respect prefers-reduced-motion (already global).
- Every change verified with build + lint; deploy in a batch at the end (interactive).

## Items (ranked by "makes it feel like a product")

### P0. Landing / home page  [NEW — front door before the dashboard]
- A real landing at the root that explains Permitly before diving into the board:
  hero (one-liner + subhead + primary CTA "See the live board" / "Try the demo"),
  a short "how it works" (email in -> agent fills -> you approve -> renewed), the
  four-sponsor / real-capability line, and the DEMO honesty note.
- Routing: hash route `#/` = landing, `#/board` = board, `#/case/<id>` = case.
  CTA navigates to the board. Keep it on-system (Timescale), light, no new deps.
- Must not break the no-account path: from the landing, one click reaches the
  populated demo board.

### P1. Replace `alert()` with an in-app toast/banner  [removes the one "unfinished" tell]
- Board.tsx uses `alert(msg)` for rate-limit/errors. Replace with a small
  dismissible toast (top-right) or an inline banner. Reuse the pill/card styles.
- Add a lightweight toast context or a local state banner (no new dep needed).

### P2. Browser chrome / meta / favicon  [cheap, high perceived polish + helps social preview]
- index.html: proper <title> "Permitly — compliance on autopilot", meta
  description, theme-color, OG/Twitter tags (title, description, image) so the
  shared link in the social post renders a card.
- Confirm favicon.svg is the Permitly mark (already exists in public/).

### P3. Polished loading + empty states  [products don't show raw text]
- Board loading: skeleton rows (shimmer) instead of "Loading your compliance
  board…".
- Case view loading: skeleton panels.
- Keep the existing empty state but refine copy/spacing.

### P4. Board framing (cold-open clarity)  [helps a judge landing with no context]
- Add a concise page title + one-line subtitle above the KPIs explaining what the
  board is ("Your business permits and licenses, tracked and renewed for you.").
- Consider a small "How it works" hint or a link to trigger the demo flow.

### P5. Header refinement  [anchors the product]
- Make the business context feel intentional (e.g. a subtle divider, an avatar/
  monogram for the business, maybe a disabled "Add permit" affordance to imply
  scope). Keep it minimal and on-system.

### P6. Case view head + hierarchy  [the video's main screen]
- Show the permit deadline + agency cleanly in the head; make the status pill and
  progress feel connected. Tidy spacing so Plan/Activity/Live read as one product.
- Ensure the receipt bar + approval bar never both crowd; consistent spacing.

### P7. Micro-interactions + refinement  [the "expensive" feel]
- Card hover elevation, row focus states, button active states, subtle transitions
  on status changes. Nothing flashy — restraint.

### P8. Don't break on mobile  [a judge may open on a phone]
- Verify board table + case grid degrade acceptably at 375px (stack, scroll).
  Desktop-first stays, but no broken layout.

## Verify + ship
- After each item: npm run build + npm run lint (+ npm test if backend touched).
- Batch deploy to prod at the end (interactive npm run deploy) + a visual pass
  in the browser at 1280px and 375px.
- Update hackathon.md/README only if user-facing behavior changes.

## Status
- [ ] P0. Landing / home page
- [ ] P1. Toast/banner (kill alert)
- [ ] P2. Meta/favicon/OG
- [ ] P3. Loading + empty skeletons
- [ ] P4. Board framing
- [ ] P5. Header refinement
- [ ] P6. Case view head + hierarchy
- [ ] P7. Micro-interactions
- [ ] P8. Mobile doesn't break
