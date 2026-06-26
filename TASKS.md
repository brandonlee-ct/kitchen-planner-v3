# Brown Box Kit Planner — Task Board

> **Single source of truth / index.** This board is the one place for what's done and what's next.
> Detailed specs live in the linked files — update THIS board when a task moves.
> Plain-English plan: `ROADMAP.md` · Technical plan: `ARCHITECTURE.md`.
> Current execution order (how / now): `.cursor/plans/auto-design_go-live_sprint_ea6d98db.plan.md`.

Legend: ✅ done · ⏳ in progress · ⬜ todo · 👤 needs you · 🧠 Opus

## Programme map — 4 tracks
Every active piece of work belongs to one track. Each links to its own spec; the detailed
checklists further down are grouped by these tracks.

| Track | What | Spec | Status |
|---|---|---|---|
| **1 — Planner Phase 1 (Shopify MVP)** | Core planner, items 1.1–1.14 | `ROADMAP.md` / `ARCHITECTURE.md` | ✅ Launched 14 Jun 2026 — only `1.7` login bridge open 🧠 |
| **2 — Auto-Design** (own track) | "Magic button" auto-layout | `AUTO-DESIGN-PLAN.md` | ⏳ Wiring behind hybrid gate (role `super_admin`/`hq_admin`/`admin` OR `?autodesign=1`, default OFF). Solver stays in-browser; API/extraction deferred to Phase 3. |
| **3 — Cross-repo integration** (NEW) | Planner ↔ Trade link | `P2-MONOREPO-BRIEF.md` | ⏳ `project_code` join key + planner-admin RLS. SQL authored, **not applied**; awaiting owner apply + Trade key confirm. |
| **4 — Phase 2 (Pro)** | Post-launch upgrades | `ROADMAP.md` Part 3 | ⏳ Bluetooth laser measure done; rest queued. |

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
- [x] ✅ K polish: opening selection highlight bright green; editable opening width/height in 3D dim editor (mirrors elevation D6/D7, undo via `edit-opening`)
- [x] ✅ 1.6 Embed planner in Shopify storefront (Task O Phase 1: `?embed=1` mode — `getUrlMode`/`applyUrlMode`, `.mode-embed` slim chrome, README usage docs; subdomain-link + iframe paths). App Block deferred to Phase 2.
- [x] ✅ 1.11 Read-only share links (`?share=<slug>`) — share button per project row, slug generated + stored in Supabase (`is_public`, `share_slug` columns), read-only badge, save controls hidden for viewers

## Track 2 — Auto-Design ⏳  (spec: `AUTO-DESIGN-PLAN.md`)
- [x] ✅ Pure solver modules (`auto-design.js`, `auto-design-rules.js`, tests, fixtures) — isolated, no UI/3D deps (API-ready), unit-tested and committed.
- [ ] ⏳ Wire into planner via wizard + adapter + toolbar button, behind the hybrid rollout gate
  (role `super_admin`/`hq_admin`/`admin` OR `?autodesign=1`; default OFF; `AUTO_DESIGN_DEFAULT` flips at launch; hard kill `window.AUTO_DESIGN_KILL`). See the go-live sprint plan.
- [ ] ⬜ NZBC disclaimer in wizard Step 4 (Phase 4 polish; copy drafted: 30-word wizard + 60-word PDF footer).
- Architecture (Opus): solver stays **in-browser** for launch; API / shared-package extraction deferred to Phase 3 / first reuse (the pure module is the extraction seam).

## Milestone C — Bridge + review
- [ ] ⬜ 1.7 Shopify Customer Account → Supabase JWT bridge 🧠
- [x] ✅ 1.10 Tall/corner/island snap rules + height tiers (Task N: `getPlacementCategory`, category placement heights — wall cabinets @1500mm AFFL, corner-drop preference, island wall-snap resistance; reviewer-approved, awaiting owner browser smoke test)
- [x] ✅ 1.12 Analytics stub — `trackEvent()` wired at: planner_opened, project_saved, project_loaded, send_to_cart, share_link_created (console log Phase 1; swap body for PostHog etc. later)
- [x] ✅ 1.13 Privacy policy + T&Cs — links in hamburger menu → brownboxkit.co.nz/pages/privacy-policy + /terms-of-service; NZ Privacy Act 2020 + CGA content drafted
- [x] ✅ 1.14 Pre-launch architecture review 🧠 (Task Q: core stability + Phase 1 completeness + drift + production-readiness audit; verdict "ready with fixes" → launch-hardening blockers B1–B4 fixed in `7c32a89`)

## Track 3 — Cross-repo integration ⏳  (spec: `P2-MONOREPO-BRIEF.md`)
Links planner projects to Trade jobs via a shared DB key — no direct calls between codebases.
- [ ] ⏳ `projects.project_code` join key — generated on save, stamped on the Shopify cart as the `project_code` attribute, backfills legacy rows. Code in `auth.js` + `main.js`. SQL: `supabase/project-code.sql` (authored, **not applied**).
- [ ] ⏳ Planner-admin RLS — `public.planner_is_admin()` restricts cross-user project access to `super_admin`/`hq_admin`/`admin`; every other shared/Trade role is scoped out. SQL: `supabase/planner-admin-roles.sql` (authored, **not applied**). Does NOT touch shared `is_admin()`/`profiles`/role CHECK.
- [ ] 👤 Owner: apply both SQL files in Supabase (additive, reversible) — Deploy 1 of the go-live sprint.
- [ ] 👤 Trade: confirm the cart attribute key is exactly `project_code`; add `super_admin` to the shared `profiles.role` CHECK.

## Open — needs Opus 🧠
- [ ] 1.7 Shopify Customer Account → Supabase JWT single-login bridge (deferred; not blocking launch — see Milestone C).
- [ ] **Doc-fix (Law O):** `AUTO-DESIGN-PLAN.md` §1.8 (feature/auto-design branch) contradicts `AGENTS.md` (core planner work on `main`). The live go-live sprint follows `AGENTS.md` (straight commits on `main`). Reconcile by amending §1.8; until then, `AGENTS.md` wins.

## Setup / tooling
- [x] ✅ AGENTS.md (project memory for all agents)
- [x] ✅ ARCHITECTURE.md + ROADMAP.md (plans)
- [x] ✅ executor + reviewer subagents (`.cursor/agents/`)
- [x] ✅ Supabase security SQL drafted
- [x] ✅ Catalogue setup guide ([public/catalog-setup.html](public/catalog-setup.html)) + product thumbnails in panel (Shopify `featuredImage`)

## 🚀 Phase 1 LAUNCHED — 14 Jun 2026
- [x] ✅ Shopify nav link added: "Design Your Kitchen" → https://planner.brownboxkit.co.nz (Option A, standalone tab)
- [x] ✅ Smoke test passed: sign-in, draw room, place cabinet, save/reload, Send to Cart, quote PDF — all confirmed on live URL
- [ ] ⬜ 1.7 Shopify Customer Account → Supabase JWT bridge (deferred, not blocking launch) 🧠

## Phase 2 (Pro) — active
- [x] ✅ 2.4 Task Y: Bluetooth laser measurement — COMPLETE. Confirmed working on Bosch GLM 50-27 CG (service 02a6c0d0). acceptAllDevices picker (GLM doesn't advertise name/service in BLE advert); Bosch binary protocol (c055 float32 + auto-sync handshake); Nordic UART fallback (Leica Disto etc.); Bluetooth SVG icon — blue when connected, dark when disconnected; graceful fallback alert with Bluefy hint for iOS. Chrome + Edge confirmed on desktop.
- Full Phase 2 + Phase 3 lists in `ROADMAP.md`.
