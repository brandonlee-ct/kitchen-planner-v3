# Brown Box Kit Planner — Progress Snapshot

> PM-level status at a glance. The living board is [TASKS.md](TASKS.md) (single source of
> truth for what's done / next); [ROADMAP.md](ROADMAP.md) is the plain-English plan. This
> file summarises — update **TASKS.md** when a task moves, then refresh this snapshot.

_Refreshed 7 Oct 2026 by `O-opus-07oct26` (O, PM — H's local Cursor session): H's 6 Oct reading and rulings applied (1.19 + C8 ✅, C12 bathroom ruling, C10 cleared for build, R4 runnable). Local `main` is ahead of `origin/main` by the 6 and 7 Oct docs commits until H pushes. Earlier stamp kept below._

_Last updated: 6 Oct 2026 by `O-opus-06oct26` (O, PM — Opus subagent in H's local Cursor session). Synced from TASKS.md + git: local `main` = `origin/main` = `c812c64` before this docs commit. This snapshot supersedes an unattributed, uncommitted 29 Sep draft whose deploy table was written the day before the push and was wrong (it gave live = `d7fd48a`, "15 commits ahead")._

## Deploy reality (read this first)

| Where | Commit | What it means |
|---|---|---|
| **Live** (Vercel / `origin/main`) | `c812c64` | Pushed **30 Sep 2026** (reflog `origin/main@{2026-09-30 00:57:29 +1300}: update by push`). Includes **C3** bfcache fix, **1.18** (dormant), **1.19** store-only filter, **C8** 1.18 fixes. Live bundle `assets/index-D9aV4O2w.js` contains `store-only`, `store_only`, `will NOT resolve` and `pageshow` (A verified 6 Oct; O re-fetched read-only 6 Oct). |
| **Local `main`** | `c812c64` + the 6 Oct docs commits | **0 commits ahead at the time of writing.** The 6 Oct O docs commits are local until H pushes (docs only — no code change). |

**1.19 and C8: ✅ H live-verified on desktop, 6 Oct 2026** (1.19: 22 store-only hidden; C8: as far as the data allows — no `component_skus` exist yet). The touch leg of 1.19 is not separately confirmed. H live-verified **C3 on desktop** 31 Aug 2026; iPad/iPhone Safari leg of runbook R5 still optional.

**Catalogue — H reading 6 Oct 2026 22:50** (`?catalogaudit=1`, live): 227 products (1 draft) / 1 missing `glb_url` (INSTALL QUOTE REQUEST, by design) / 0 unparseable / 0 missing category / 0 `component_skus` / 22 store-only hidden.

---

## Programme map (4 tracks + spec-first)

| Track | Status (summary) |
|---|---|
| **1 — Phase 1 Shopify MVP** | ✅ **Launched** 14 Jun 2026. Sprint 1 code closed (S1–S5). Open: **1.7** login bridge 🧠, **1.15c** owner catalogue data (partial), **1.17b** cosmetic, **1.18** (dormant, awaiting R4) / **1.19** deployed, awaiting H live verify. |
| **2 — Auto-Design** | ⏳ Solver modules ✅; UI wizard + toolbar wiring ⏳ behind hybrid gate (`?autodesign=1` / admin roles). |
| **3 — Planner ↔ Trade** | ⏳ Checkout capture ✅ verified (#1034/#1035). SQL for `project_code` + planner-admin RLS **authored, not applied** — H runbooks R2/R3. |
| **4 — Phase 2 (Pro)** | ⏳ Bluetooth laser ✅; rest queued in ROADMAP Part 3. |
| **5 — DIY mode** | Spec ✅ (DIY-1); build (DIY-2) unblocked, not scheduled. |
| **6 — Complete-Unit SKUs** | ⬜ Spec ✅ (U-spec). **U2+ not scheduled** — gates: **U0** data, **1.18** live-verified (R4), **C12** confirmation. **F8** ruled: Direction 1 (kitchen) first. |

---

## LEGEND

> Full role charters + fresh-chat boot prompts: [ROLES.md](ROLES.md).

**Owner**

- `S` = coding sub-agent (Composer)
- `O` = PM
- `H` = Human
- `A` = Fable auditor / owner advisor

**Task IDs (PM convention, not control authority)**

- `O#` = PM planning/contract task (sequential)
- `S#` = coding sub-agent build task (sequential)
- Gates are `H` sign-offs and carry no task ID

**Status**

- `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[?]` needs human decision
- Board also uses: ✅ done · ⏳ in progress · ⬜ todo · 👤 needs you · 🧠 Opus

---

## Status: LIVE

Phase 1 at [planner.brownboxkit.co.nz](https://planner.brownboxkit.co.nz), Shopify nav “Design Your Kitchen”. Core journey works: sign-in, draw, place cabinets, save/reload, Send to Cart, quote PDF/CSV, share links, embed mode.

---

## Shipped (high level)

- **Milestone A — Harden:** touch wall selection, save/load toasts, RLS on `projects` + `profiles`, thumbnails bucket, share columns.
- **Milestone B — MVP:** Free/Quick Draw, mobile toolbar, Send to Cart, PDF/CSV, thumbnails, GPOs, dim editor, 300mm slab + scene_json v2, embed, share links.
- **Sprint 1 (Items 0–5):** catalogue audit tool (1.15a–d), dimension parsing, draft stash + autosave (1.16), service quote-only lines (1.17, scene_json v4).
- **Milestone C:** snap/height tiers (1.10), analytics stub (1.12), privacy/T&Cs (1.13), pre-launch review (1.14).
- **Track 3:** checkout stamps `project_code` + `display_po` — verified with orders #1034/#1035 (21 Aug).
- **Bug C3:** Send-to-Cart stuck after browser Back — **live on desktop** (31 Aug).
- **Phase 2:** Bluetooth laser measure (Task Y).
- **DIY-1:** plan signed off. **F8 ruling (31 Aug):** kitchen planner first; whole-house = placeholder only.

---

## In progress (code or wiring)

- **1.18 Component SKUs** — on `origin/main` but **dormant** (no metafield data). C8 ✅ (6 Oct), so **R4 is runnable now** (H).
- **1.19 Store-only catalogue filter** — ✅ live-verified desktop 6 Oct.
- **Track 2 — Auto-Design** — wire solver into planner (wizard + gate).
- **Track 3** — owner applies Supabase SQL; Trade confirms `project_code` key.

---

## Blockers & live defects (customer-facing)

- **C12** — **H ruled 6 Oct:** bathroom products are in scope (a vanity = one product, one GLB). **H reports the 6 bathroom accessories tagged `store-only`, 7 Oct.** 👤 H: read the live `?catalogaudit=1` store-only line and send the number. C12 then closes with no code change. Do **not** blanket-hide `kitchen hardware`.
- **C9** (live revenue risk) — no out-of-stock warning before checkout; A granted options 1+2; brief ready 6 Oct, awaiting S build.

_C11 was closed 6 Oct 2026 by H ruling: `(drft)` products are intentionally visible for live testing, and they are customer-visible during the test period by owner decision. It is not a defect._

Details: [RELAY.md](RELAY.md). H's dated counts (6 Oct 22:50) are now on the TASKS board under `1.15c`.

---

## What's next (execution order)

**Owner (H) — unblocks deploy and data**

Step-by-step: [RELAY.md](RELAY.md) § **R9** (6 Oct owner asks).

1. ~~Live verify 1.19 + C8~~ — **done 6 Oct (desktop).** Optional: 1.19 touch leg; R5 iPad/iPhone Safari leg for C3.
2. ~~R1 dated `?catalogaudit=1` reading~~ — **done 6 Oct 22:50.**
3. **C12** — tag the 6 bathroom accessories `store-only` and report (R9 step 3, revised 7 Oct).
4. **R4** — runnable now: populate `planner.component_skus` + Storefront exposure, then live-verify 1.18.
4a. **Approve or reject** the bathroom-vanity scope paragraph for `UNIT-SKU-PLAN.md` (RELAY 7 Oct O entry).
5. **Staff guide** `public/shopify-planner-guide.html` (untracked) — assign to a board item and commit, or delete.
6. **Push local `main`** after O's 6 Oct docs commits.
7. **R2 / R3** — Apply Track 3 Supabase SQL; confirm Trade intake uses `project_code`.

**PM / build (O → S) — when scheduled**

- **C9 — first.** OOS badge + pre-cart warning (A granted options 1+2). Brief ready and A-passed: [briefs/C9-oos-badge-and-precart-warning.md](briefs/C9-oos-badge-and-precart-warning.md); awaiting H to schedule the S build.
- **C10 — after C9.** Openings add/delete → undo/redo + autosave. A confirmed the shape 6 Oct; nits folded 7 Oct. Brief: [briefs/C10-opening-history.md](briefs/C10-opening-history.md); S build may be scheduled.
- **Track 2** — Auto-design UI wiring.
- **DIY-2** — Square room + wizard steps 1–2 (brief ready).
- Backlog: 1.17b, C6 CSV escaping, cosmetics C1/C2/C4/C7, F6 login gate, F7 analytics.

**Deferred / Opus**

- **1.7** Shopify Customer Account ↔ Supabase JWT bridge.

Full checklist, bugs, and register: [TASKS.md](TASKS.md) · handoffs: [RELAY.md](RELAY.md) § standing register.

---

## Known constraints

- iOS Safari: no Web Bluetooth (laser measure — Bluefy hint).
- Auto-design solver: base cabinets, standard widths only; others → “skipped” warnings.
- Item-10 smoke: some touch/iPad cases still open per [SMOKE-SCRIPT.md](SMOKE-SCRIPT.md).
