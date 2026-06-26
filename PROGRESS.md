# Brown Box Kit Planner — Progress Snapshot

> PM-level status at a glance. The living boards are [TASKS.md](TASKS.md) (what's done /
> next) and [ROADMAP.md](ROADMAP.md) (plain-English plan). This file summarises; those
> two are the source of truth — update them, not this, when a task moves.

_Last updated: 24 Jun 2026._

## Status: LIVE
Phase 1 launched **14 Jun 2026** at `planner.brownboxkit.co.nz`, linked from Shopify nav
("Design Your Kitchen"). Live smoke test passed: sign-in, draw room, place cabinet,
save/reload, Send to Cart, quote PDF.

## Shipped
- **Milestone A — Harden prototype:** bug-fix sweep (touch wall selection iOS/Android,
  save/load toasts, 2D labels after load); Supabase **RLS enabled** on `projects` +
  `profiles`, roles + admins live, thumbnails bucket.
- **Milestone B — Shopify MVP:** Free Draw + Quick Draw (camera lock, 90 deg snap, angle
  guides, parametric rescale, auto-floor, 300mm slab); mobile toolbar; Send to Cart
  (`cartCreate` -> checkout); Quote PDF + CSV; thumbnails -> Supabase Storage; power
  points in elevation; elevation/3D dimension editor; embed mode (`?embed=1`); read-only
  share links (`?share=<slug>`).
- **Milestone C:** snap rules / height tiers; analytics stub (`trackEvent`); privacy +
  T&Cs; pre-launch architecture review (blockers B1-B4 fixed).
- **Phase 2 (Pro):** Bluetooth laser measurement (Task Y) — confirmed on Bosch GLM
  50-27 CG, Leica/Disto UART fallback, Chrome + Edge desktop.

## In progress
- **Auto-design "magic button"** — wiring the already-built solver
  ([auto-design.js](auto-design.js) + [auto-design-rules.js](auto-design-rules.js),
  unit-tested) into the planner via a wizard + adapter + toolbar button. Follows
  [AUTO-DESIGN-PLAN.md](AUTO-DESIGN-PLAN.md) Phases 2-3. Ships behind the
  `window.AUTO_DESIGN_ENABLED` kill switch.

## Open / next
- **1.7 Shopify -> Supabase single-login bridge** — last Phase 1 item, deferred
  (not blocking launch); flagged needs-Opus (architecture).
- **Auto-design Phase 4 polish** (deferred follow-up): glide-draw handoff, warnings
  drawer, Clear/Regenerate buttons, NZBC disclaimer copy.
- **P2 `bbk-suite` monorepo** — separate business track (Trade/Academy/KPI/Inventory)
  sharing the planner's Supabase project; foundation brief in
  [P2-MONOREPO-BRIEF.md](P2-MONOREPO-BRIEF.md).

## Known constraints
- iOS Safari has no Web Bluetooth (laser measure falls back with a Bluefy hint).
- Auto-design solver only matches catalogue products with `category: "base"` and standard
  widths (900/800/600/500/400/300mm); unmatched cabinets surface as "skipped" warnings.
