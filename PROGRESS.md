# Brown Box Kit Planner — Progress Snapshot

> PM-level status at a glance. The living board is [TASKS.md](TASKS.md) (single source of
> truth for what's done / next); [ROADMAP.md](ROADMAP.md) is the plain-English plan. This
> file summarises — update **TASKS.md** when a task moves, then refresh this snapshot.

_Refreshed 15 Oct 2026 by `O-opus-14oct26` (same session, later): C10 built (`394897a`), not pushed, not browser-tested. A audits that code before any push. Earlier stamp kept below._

_Refreshed 15 Oct 2026 by `O-opus-14oct26` (same session): C9 live-verified on the live site (brief §6). M2 (C10) is unlocked and waits for H's "continue". This record is local until H says to push. Earlier stamp kept below._

_Refreshed 14 Oct 2026 by `O-opus-14oct26` (O, PM — Opus, H's local Cursor session): pushed `cdec6e1` on H's instruction; H's 14 Oct rulings recorded (F1 link column enough; new F1b/F1c; F9 = capture/export). Docs only. Earlier stamps kept below._

_Refreshed 12 Oct 2026 by `O-opus-12oct26` (O, PM — Opus, H's local Cursor session), F programme M0: H's 12 Oct rulings are on the board, and "What's next" now follows the F programme order. Before this commit, `origin/main` = local `main` = `b343090` (`git ls-remote`, 12 Oct). O did not re-check the live bundle; this is a docs-only change. This commit is 1 ahead until H pushes. Earlier stamps kept below._

_Refreshed 11 Oct 2026 by `O-grok-11oct26` (same session): H pushed local `main`. Live and `origin/main` are `baebf95`. Staff guide is live. This recording commit is 1 ahead until it is pushed. Earlier stamp kept below._

_Refreshed 11 Oct 2026 by `O-grok-11oct26` (O, PM — Grok 4.7 in H's local Cursor session): A's 11 Oct repo-hygiene audit applied (docs-only). Programme-map row 1 now matches the board: 1.19 live-verified on desktop. Local `main` stays ahead of `origin/main` until H pushes. Earlier stamp kept below._

_Refreshed 7 Oct 2026 by `O-opus-07oct26` (O, PM — H's local Cursor session): H's 6 Oct reading and rulings applied (1.19 + C8 ✅, C12 bathroom ruling, C10 cleared for build, R4 runnable). Local `main` is ahead of `origin/main` by the 6 and 7 Oct docs commits until H pushes. Earlier stamp kept below._

_Last updated: 6 Oct 2026 by `O-opus-06oct26` (O, PM — Opus subagent in H's local Cursor session). Synced from TASKS.md + git: local `main` = `origin/main` = `c812c64` before this docs commit. This snapshot supersedes an unattributed, uncommitted 29 Sep draft whose deploy table was written the day before the push and was wrong (it gave live = `d7fd48a`, "15 commits ahead")._

## Deploy reality (read this first)

| Where | Commit | What it means |
|---|---|---|
| **Live** (Vercel / `origin/main`) | `cdec6e1` | **14 Oct 2026:** O pushed `29444e2..cdec6e1` on H's quoted instruction (four docs-only commits). Vercel status for `cdec6e1`: "Deployment has completed". The bundle is unchanged, still `assets/index-BytXTjAb.js` (O fetched it read-only). _12 Oct row, kept:_ **12 Oct 2026, 04:11:** pushed by O on H's instruction and approval (`b343090..29444e2`). **C9 is deployed:** the live bundle is now `assets/index-BytXTjAb.js` and contains the C9 strings (O fetched it read-only). H has not live-verified C9 yet. Earlier: `b343090` was the docs-only state before this push; it had the same bundle as `baebf95` (A's M0 nit 2). _11 Oct row, kept:_ `baebf95` pushed **11 Oct 2026** (`c812c64..baebf95`). Docs plus the staff guide. Planner bundle unchanged: `assets/index-D9aV4O2w.js` (O fetched 11 Oct, HTTP 200). Guide `https://planner.brownboxkit.co.nz/shopify-planner-guide.html` returned 200. Prior code push remains inside this history (`c812c64`, 30 Sep). |
| **Local `main`** | `cdec6e1` + this docs commit | **14 Oct:** equal to `origin/main` after the push. The 14 Oct rulings commit is pushed on H's same instruction; the later C9 check record waits for H's word. |

**1.19 and C8: ✅ H live-verified on desktop, 6 Oct 2026** (1.19: 22 store-only hidden; C8: as far as the data allows — no `component_skus` exist yet). The touch leg of 1.19 is not separately confirmed. H live-verified **C3 on desktop** 31 Aug 2026; iPad/iPhone Safari leg of runbook R5 still optional.

**Catalogue — H reading 6 Oct 2026 22:50** (`?catalogaudit=1`, live): 227 products (1 draft) / 1 missing `glb_url` (INSTALL QUOTE REQUEST, by design) / 0 unparseable / 0 missing category / 0 `component_skus` / 22 store-only hidden.

---

## Programme map (4 tracks + spec-first)

| Track | Status (summary) |
|---|---|
| **1 — Phase 1 Shopify MVP** | ✅ **Launched** 14 Jun 2026. Sprint 1 code closed (S1–S5). Open: **1.7** login bridge 🧠, **1.15c** owner catalogue data (partial), **1.17b** cosmetic, **1.18** (dormant, awaiting R4) / **1.19** ✅ live-verified desktop 6 Oct (touch leg optional). |
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
- **C9** — **✅ H live-verified 14–15 Oct 2026** (desktop Chrome; brief §6 steps 4, 5, 10 and 6 pass; 11 and 12 confirmed, with the limits on the board). No longer a live defect.

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
5. ~~Staff guide~~ — **done 10 Oct.** Committed under Setup and linked from the catalogue setup page.
6. ~~Push local `main` after O's 6 Oct docs commits.~~ — **done 11 Oct.**
7. **R2 / R3** — Apply Track 3 Supabase SQL; confirm Trade intake uses `project_code`.

**PM / build (O → S) — the F programme (H, 12 Oct 2026). One S unit in flight; milestone-by-milestone with an A audit at each STOP.** Rulings and the per-item gates are in [TASKS.md](TASKS.md) § Future scope → F programme.

1. **C9** — **✅ H live-verified 14–15 Oct 2026.** M1 is closed. Limits are on the board line.
2. **C10** — M2 **built 15 Oct, commit `394897a` (reviewer: ship). A audit PASS-WITH-NITS 15 Oct, push released. NOT pushed, NOT verified.** `main.js` only. 👤 H: give the push sentence, then live-verify per the brief §5.
3. **F1 + C6** — M3 brief, then M4 build. CSV image column plus one escaping helper (C6 is folded in). Brief A-passed with nits 14 Oct (nits folded). H ruled 14 Oct that the link column is enough.
3a. **F1b** — `.xlsx` export beside the CSV (same rows and totals, no pictures). A one-page library scoping note comes first, and H picks the library before any brief. It starts after F1 is live-verified.
3b. **F1c** — pictures embedded in the `.xlsx`, using F1b's library. It starts after F1b is live-verified.
4. **F2** — M5 brief, then M6 build. PDF thumbnails, grouped by category.
5. **F3** — M7 design note (plan + elevation drawings). Briefs follow only after H signs off the note.
6. **F6** — M9 scoping: what a guest may do before sign-in. An H ruling comes before any brief.
7. **F7** — M10 scoping: analytics vendor and cost. It stops at H's spend/vendor decision.
8. **F5** — M11 runbooks R6/R7/R8 and a ROLES.md human-roles draft. H applies them.
9. **F9** — last. **H answered 14 Oct: capture/export** (better 3D-view screenshots: resolution, UI hidden, save/attach). Renders are out of scope. Not yet briefed.

Deferred by H (12 Oct): cosmetics C1/C2/C4/C7. Closed for this programme: F4, F8.
Not in the programme and unscheduled while it holds the S slot: Track 2 auto-design wiring, **DIY-2** (unblocked, but its build brief is **not written yet** — the board governs; this snapshot's earlier "brief ready" was wrong), 1.17b, the C13 candidate.

**Deferred / Opus**

- **1.7** Shopify Customer Account ↔ Supabase JWT bridge.

Full checklist, bugs, and register: [TASKS.md](TASKS.md) · handoffs: [RELAY.md](RELAY.md) § standing register.

---

## Known constraints

- iOS Safari: no Web Bluetooth (laser measure — Bluefy hint).
- Auto-design solver: base cabinets, standard widths only; others → “skipped” warnings.
- Item-10 smoke: some touch/iPad cases still open per [SMOKE-SCRIPT.md](SMOKE-SCRIPT.md).
