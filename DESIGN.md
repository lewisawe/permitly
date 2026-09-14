# Permitly — Design

The canonical design system for this app is **`../DESIGN.md`** (the "Timescale —
engineering blueprint on warm graph paper" reference) at the hackathon project
root. Follow that file. This note only records how it maps into the app.

## Applied in the app

- **Canvas:** warm paper `#fafafa` (never pure white) + a subtle graph-paper dot
  grid (`src/index.css` body background).
- **Type:** Geist (interface/headings) + Geist Mono (numbers, deadlines, codes,
  labels, confirmation numbers) — loaded in `index.html`.
- **Color discipline:** near-monochrome. Carbon black does all structure
  (borders, text, button fills). Signal Orange `#ff5b29` = emphasis only (stat
  numerals, overdue deadlines, "needs attention"); never a button fill.
  Chartreuse `#f5ff80` = spotlight only (the approval bar + states needing the
  human). No third chromatic color.
- **Shape:** cards 12px + hard offset shadow `5px 5px 0px #000`; buttons/tags
  pill (9999px); small buttons 4px.
- **Buttons:** black fill = primary action; outline = secondary; ghost =
  underlined link. Orange is never a fill.
- **Theme:** light only (the reference is a light system).

## Surfaces in the app

- Board: KPI stat cards (orange mono numerals) + permit table, both with the
  hard offset shadow and black hairlines.
- Case view: step plan, activity timeline, Firecrawl live-view panel, and a
  chartreuse approval bar with a black "Approve & submit" CTA.
- Mock portal: intentionally plain government-form styling, distinct from
  Permitly's own look, labeled DEMO.
