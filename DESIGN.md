# Permitly — Design

> UI design guide for Permitly. Source of truth for look, feel, and component
> behavior. Built on the ui-ux-pro-max "Data-Dense Dashboard" system, adapted for
> a small-business compliance tool. Pairs with SPEC.md (product/architecture).

## Design intent

A calm, trustworthy operations board for a stressed small-business owner. The
product does anxious work (deadlines, government forms), so the UI must feel the
opposite: orderly, legible, in control. Data-dense but not cluttered. The hero is
the live compliance board, not a marketing page — users land straight in the app.

## Principles

1. Status at a glance. Every permit's health readable in one scan (color + label + icon, never color alone).
2. The agent is visible, never magic. Show what it is doing and what it will do next; the human approves real actions.
3. Reactive, not busy. Live updates animate in gently (150-300ms); no spinners-as-decoration.
4. Trust through clarity. Plain language, confirmation numbers shown, receipts downloadable, "DEMO" clearly labeled.

## Color tokens (light)

```
--color-primary:        #1E40AF   /* deep blue: primary actions, headers */
--color-on-primary:     #FFFFFF
--color-secondary:      #3B82F6   /* lighter blue: secondary emphasis, links */
--color-accent:         #D97706   /* amber: the ONE CTA per view (Approve) */
--color-on-accent:      #FFFFFF
--color-background:     #F8FAFC
--color-foreground:     #0F172A   /* darkened from generated #1E3A8A for 4.5:1 body text */
--color-card:           #FFFFFF
--color-card-foreground:#0F172A
--color-muted:          #E9EEF6
--color-muted-foreground:#475569
--color-border:         #DBEAFE
--color-destructive:    #DC2626   /* overdue / failed */
--color-on-destructive: #FFFFFF
--color-ring:           #1E40AF
```

Dark mode (support before delivery): dark slate surfaces (#0F172A bg, #1E293B
card), same blue/amber accents, borders lifted to a visible slate. Test both
themes; do not infer dark from light.

### Status colors (permit lifecycle)

| Status | Color | Meaning |
|--------|-------|---------|
| tracked | muted/slate | known, not yet due |
| in_progress | secondary blue | agent working |
| awaiting_info | amber | needs a field from the owner |
| awaiting_approval | amber (emphasized) | needs the owner to approve a submission |
| submitted | secondary blue | sent, awaiting confirmation |
| renewed | green (#16A34A) | done, next deadline set |
| failed / overdue | destructive red | needs attention |

Deadline urgency: >14d neutral, <=14d amber text, <=3d or past = red.

## Typography

- Headings/UI: **Fira Sans** (300-700).
- Numbers/IDs/confirmations/dates: **Fira Code** (monospace) — keeps columns and
  confirmation numbers aligned and legible.
- Google Fonts: `Fira+Code:wght@400;500;600;700` + `Fira+Sans:wght@300;400;500;600;700`.
- Body text >= 16px, 4.5:1 contrast. Line-height 1.5 body, 1.2 headings.

## Icons

- Vector only, one family: **Lucide** (`lucide-react`). No emoji as structural icons.
- Consistent stroke; sizes as tokens (16 / 20 / 24). Decorative icons `aria-hidden`;
  icon-only buttons get an accessible label.

## The three surfaces

### 1. Compliance board (hero, route `/`)
- Header: brand, the Permitly inbox address (label it, treat value as non-secret
  demo data), theme toggle, "Add permit".
- KPI row: # permits, # due soon, # needs you (awaiting_info/approval), # renewed.
- Permit grid/table: one card/row per permit — type, agency, deadline (urgency
  colored), status pill, and a primary affordance when it needs the human
  ("Review" / "Approve"). Row hover highlight; click opens the case.
- Empty state: a "Forward an email to get started" prompt + a Seed demo button.

### 2. Case timeline (route `/case/:id`)
- Left: the step plan (find page -> read form -> fill -> book -> approve ->
  submit -> receipt), each with status.
- Center: the turn timeline (inbound email, agent action, outbound email,
  system) newest-last, reactive.
- Right/embedded: the **Firecrawl live view** iframe (the demo hero) — the human
  watches the browser fill the form; a note says they can take over.
- Approval bar (sticky bottom) when `awaiting_approval`: plain-language summary of
  the exact action + a single amber **Approve** button and a secondary Reject.
  This is the only amber CTA on the screen.

### 3. Mock portal (route `/demo-portal/*`, labeled DEMO)
- A believable "Springfield City Permits" site: login, a food-handler renewal
  form, an inspection booking page (date-slot picker). Plain, government-form
  aesthetic (intentionally utilitarian, distinct from Permitly's own styling).
- Persistent "DEMO PORTAL — not a real agency" banner.

## Interaction + motion

- Transitions 150-300ms ease. Respect `prefers-reduced-motion` (no transforms,
  instant state). Live rows fade/slide in gently.
- `cursor-pointer` on every clickable; visible focus ring (`--color-ring`) on all
  interactive elements; logical tab order.
- One primary CTA per view (Approve on the case; Add permit on the board).

## Accessibility (WCAG AA)

- 4.5:1 text contrast; status conveyed by icon+label+color, never color alone.
- Keyboard: full nav, visible focus, Approve reachable and operable by keyboard.
- Live regions announce status changes (a permit flipping to "renewed").
- Forms (mock portal + add-permit) have labels, hints, inline errors.

## Component inventory (lean)

Board: `Header`, `KpiCard`, `PermitRow`/`PermitCard`, `StatusPill`, `EmptyState`.
Case: `StepList`, `TurnTimeline`, `LiveViewPanel`, `ApprovalBar`.
Shared: `Button` (primary/secondary/accent/ghost), `Badge`, `ThemeToggle`.
Mock portal: `PortalLayout` (DEMO banner), `RenewalForm`, `BookingPicker`.

Keep it thin: most screens are reactive `useQuery` reads over Convex tables. The
intelligence is in the backend; the UI is a clear, honest window onto it.

## Pre-delivery checklist

- [ ] No emoji icons (Lucide SVG only)
- [ ] cursor-pointer + visible focus on all interactive elements
- [ ] Hover states, 150-300ms transitions, reduced-motion respected
- [ ] Light + dark both tested (not inferred)
- [ ] Text contrast >= 4.5:1; status never color-only
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] One primary CTA per view; Approve is the amber accent
- [ ] "DEMO PORTAL" labeled; no real PII shown
