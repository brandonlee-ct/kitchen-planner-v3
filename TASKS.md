# Brown Box Kit Planner — Task Board

Living status board. Source of truth for what's done / next. See `ROADMAP.md` for plain-English
detail and `ARCHITECTURE.md` for the technical version.

Legend: ✅ done · ⏳ in progress · ⬜ todo · 👤 needs you · 🧠 Opus

## Milestone A — Harden the live prototype
- [x] ✅ 1.1 Bug-fix sweep (wall selection on Android/iOS, save/load toasts, 2D labels after load)
- [ ] ⏳ Security: SQL written (`supabase/security.sql`). 👤 **Next: paste it into Supabase SQL Editor + run, then promote yourself to admin.**

## Milestone B — Shopify MVP Launch (Phase 1 remaining)
- [ ] ⬜ 1.2 Drawing UX overhaul (Shift 90° lock, green/blue guides, mm inputs, preset on desktop, live dims + angles, freehand weld fix, auto-floor)
- [ ] ⬜ 1.3 Mobile toolbar (44px icons, ☰ hamburger, 📷 camera capture)
- [ ] ⬜ Send-to-Cart (Shopify `cartCreate` → `checkoutUrl`) — not yet in code
- [ ] ⬜ 1.6 Embed planner in Shopify storefront (iframe for test → App Block) 👤
- [ ] ⬜ 1.8 Quote PDF (SKU, photos, qty, prices, total) 🧠→build
- [ ] ⬜ 1.9 Thumbnails → Supabase Storage (bucket created by security.sql)
- [ ] ⬜ 1.11 Read-only share links (`/p/abc123`)
- [ ] ⬜ 1.4 Power points in elevation view
- [ ] ⬜ 1.5 Elevation 5-dimension editor 🧠→build

## Milestone C — Bridge + review
- [ ] ⬜ 1.7 Shopify Customer Account → Supabase JWT bridge 🧠
- [ ] ⬜ 1.10 Tall/corner/island snap rules + height tiers 🧠
- [ ] ⬜ 1.12 Analytics (walls drawn, products placed, carts sent)
- [ ] ⬜ 1.13 Privacy policy + T&Cs + data export 👤 (legal)
- [ ] ⬜ 1.14 Pre-launch architecture review 🧠

## Setup / tooling
- [x] ✅ AGENTS.md (project memory for all agents)
- [x] ✅ ARCHITECTURE.md + ROADMAP.md (plans)
- [x] ✅ executor + reviewer subagents (`.cursor/agents/`)
- [x] ✅ Supabase security SQL drafted

## Phase 2 (Pro) & Phase 3 (White-Label SaaS)
Parked until Shopify launch ships. Full lists in `ROADMAP.md`.
