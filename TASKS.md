# Brown Box Kit Planner — Task Board

Living status board. Source of truth for what's done / next. See `ROADMAP.md` for plain-English
detail and `ARCHITECTURE.md` for the technical version.

Legend: ✅ done · ⏳ in progress · ⬜ todo · 👤 needs you · 🧠 Opus

## Milestone A — Harden the live prototype
- [x] ✅ 1.1 Bug-fix sweep (wall selection on Android/iOS, save/load toasts, 2D labels after load)
- [x] ✅ Security: RLS enabled on `projects` + `profiles`, roles live, `thumbnails` bucket created, share-link columns added. Admins: brandonlee.ct@gmail.com, brownboxkit@gmail.com.

## Milestone B — Shopify MVP Launch (Phase 1 remaining)
- [x] ✅ 1.2 Free Draw (desktop): new mode, camera lock, free-angle + 90° snap, select wall, pick locked anchor, resize (angle preserved), slide parallel; undo/redo + save/load verified
- [x] ✅ Quick Draw: camera lock during drawing (touch-friendly), keeps 90° snap + tap-to-place
- [x] ✅ 1.2b Drawing UX polish (largely done via Quick Draw popups, touch modifier dock, theme switcher, auto-floor)
- [x] ✅ 1.3 Mobile toolbar (44px icons, ☰ hamburger, 📷 camera capture)
- [x] ✅ Send-to-Cart (Shopify `cartCreate` → `checkoutUrl`)
- [x] ✅ 1.8 Quote PDF (jsPDF + autoTable)
- [x] ✅ 1.9 Thumbnails → Supabase Storage (`uploadThumbnail` in auth.js)
- [x] ✅ 1.4 Power points (GPOs) in elevation view + wall popup
- [x] ✅ 1.5 Elevation/3D dimension editor (Task K: 7 green dims, click-to-edit, doors/windows/cabinets, undo)
- [x] ✅ Tasks B–F bundle: save/restart hamburger menu, touch long-press select, wall-locked openings with 3D dims, 2D zoom/pan fix, 300mm slab (scene_json v2 + v1 migration)
- [ ] ⬜ K polish: opening selection highlight to bright green; editable opening width/height in 3D
- [x] ✅ 1.6 Embed planner in Shopify storefront (Task O Phase 1: `?embed=1` mode — `getUrlMode`/`applyUrlMode`, `.mode-embed` slim chrome, README usage docs; subdomain-link + iframe paths). App Block deferred to Phase 2.
- [ ] ⬜ 1.11 Read-only share links (`/p/abc123`)

## Parked (built but not wired in)
- Auto-design solver module (`auto-design.js`, `auto-design-rules.js`, test harness, fixtures) —
  isolated, not imported by `main.js`, no UI. Connect later via a single `runAutoDesign()` seam.

## Milestone C — Bridge + review
- [ ] ⬜ 1.7 Shopify Customer Account → Supabase JWT bridge 🧠
- [x] ✅ 1.10 Tall/corner/island snap rules + height tiers (Task N: `getPlacementCategory`, category placement heights — wall cabinets @1500mm AFFL, corner-drop preference, island wall-snap resistance; reviewer-approved, awaiting owner browser smoke test)
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
