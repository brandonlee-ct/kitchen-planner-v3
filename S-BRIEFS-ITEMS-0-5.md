# S# Task Briefs — Planner Improvements Items 0–5

> **Author:** O (PM Opus). **Source plan:** `.cursor/plans/planner_improvements_items_0-5_8598fb14.plan.md` (approved by H).
> **Governing docs:** `AGENTS.md`, `ROLES.md` §S, `LESSONS-LEARNED.md` (Law G template), `TASKS.md`.
> **How to use this file:** each brief below is one bounded unit for S (Composer). Build **one at a time, in the numbered order**, reviewer-check each, then A audits before the next. Do **not** batch (Law C). All line anchors were verified against `main.js`/`auth.js` at authoring time — if the file has drifted, re-locate by the function name, not the line number, and flag the drift (Law B).
>
> **Board mapping is stated per brief.** The `TASKS.md` amendment O proposes is at the end of this file — H/A applies it; O does not edit `TASKS.md` from plan mode.

---

## Global rules every S# brief inherits (do not repeat-violate)

These are the `AGENTS.md` house rules. Each brief's "Out of scope / do NOT touch" assumes all of these; the brief only calls out the ones with a specific trap.

- **Base:** `main`, current and pulled. Do NOT stack on unmerged work. Run `git branch --show-current` before your first commit and confirm it's `main` (or a short-lived branch named for this task). Core planner work never lands on an unrelated feature branch (AGENTS.md branch discipline, June 2026 incident).
- **No refactor of working code — add to it.** Keep existing function names and signatures; other parts of the single-file `main.js` depend on them. Changing a signature = stop-and-ask.
- **Touch + mouse parity.** There are parallel `touchstart/touchmove` and `mousedown/mousemove` paths. Mentally (and on-device) test iPhone, iPad, desktop before "done". `IS_TOUCH` already exists — use it.
- **Never break undo/redo.** Every new mutating action calls `pushHistory({ type, data })` (main.js 299) and is handled in both `executeUndo` and `executeRedo`. Capped by `MAX_HISTORY` (20).
- **three.js dispose pattern is mandatory** for any GLB/mesh you remove or swap — geometry, materials, textures. Follow existing `disposeModel()`. (Most of these briefs are diagnosis/data/UI and add no new disposable meshes — S5 is the one that adds meshes, see its note.)
- **Units:** metres internally, mm user-facing. Use the `mm(v)` helper (mm → metres).
- **Element-ID contract:** `index.html` IDs are the contract `main.js` binds to. Never rename an ID on one side only. New top-level button wiring uses the null-safe pattern: `const el = document.getElementById(id); if (el) el.addEventListener(...)`.
- **No debug instrumentation committed** (no `fetch('http://127.0.0.1...')`, no stray `console.log` spam beyond the intentional diagnostic output a brief specifies).
- **Stop and ask before:** any `scene_json` shape/version change (only S5 is authorised to do this, per its brief), any schema/RLS/Supabase change, any Shopify Storefront query change beyond what a brief authorises, any function-signature change, anything that smells like architecture/auth/security/three.js math (Opus-first — ROLES.md §S).
- **Definition of Done (Law A):** runs end-to-end with `npm run dev`, has at least one demoable action, was exercised on the target device/role, ships with a "how to test" note (Law L — starts with how to get the build on screen), build passes. "Merged" ≠ "working."
- **Post-task smoke checklist (AGENTS.md):** after ANY task, verify on desktop **and** touch: Save Project & Restart Planner in hamburger · long-press select on touch · cabinets sit on the 300mm slab (place, save, reload) · power point button in elevation · Quote CSV + PDF export · door/window select + drag along wall with dims · undo/redo · zoom speed normal with a cabinet selected. Every brief's "how to test" ends by referencing this checklist.

---

## S1 — Catalogue audit tool (`?catalogaudit=1`)

**Objective (one sentence):** Add a read-only `?catalogaudit=1` diagnostic report that lists every Shopify product and flags missing `planner.glb_url`, missing/unparseable `width_mm`/`height_mm`/`depth_mm`, missing `category`, and which fallback the planner applied — with zero change to planner behaviour.

**Board item (TASKS.md):** New item under **Track 1 (Planner Phase 1 / catalogue)** — "Catalogue audit tool" (see Board amendment `1.15a`). Diagnosis-first step of the Items 0–2 catalogue-truth work.

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.15a`.

**Files / functions / anchors to touch:**
- `main.js` `PRODUCTS_QUERY` (~4579–4607) — **read only**; you rely on the raw metafield nodes it already returns (`glb_url`, `width_mm`, `height_mm`, `depth_mm`, `category` as `{ value }`). Do not change the query in S1 (S2/S6 own query-adjacent work).
- `main.js` `shopifyNodeToProduct` (~4611–4639) — **read only** in S1; mirror its fallback logic (`|| 600 / 720 / 580`, `|| null`, `category?.value || productType || 'Other'`) so the report states which fallback each product would hit.
- `main.js` `fetchAllShopifyProducts` (~4641–4651) and `loadShopifyProducts` (~4740–4758, invoked at 4760) — add a guarded, additive audit path that runs **only** when `?catalogaudit=1` is present. Reuse `fetchAllShopifyProducts()` to get the raw nodes; do not duplicate the fetch/pagination logic.
- Read the URL the same way the rest of the file does: `new URLSearchParams(location.search).get('catalogaudit') === '1'` (pattern already used at 7686 / 9403 / `getUrlMode` 16).

**What it must do:**
- When `?catalogaudit=1` is set, after products load, produce a report for **every fetched node** (before the `(Draft)` filter — the audit should surface drafts too, labelled). For each product show: `handle`, `title`, `productType`, whether `glb_url` is present (and the URL), the raw metafield value AND the parsed result for each of `width_mm`/`height_mm`/`depth_mm`, whether each dim is missing / unparseable / OK, the raw `category` value, and a `fallbacksApplied` list (e.g. `width→600`, `glb→placeholder box`, `category→productType`).
- Output to the console via `console.table(...)` (one row per product) **and** a compact `console.group` summary (counts: N missing glb, N unparseable dims, N missing category). Optionally render an on-page overlay `<div>` if that's low-risk and null-safe — but console is the acceptance bar; the overlay is a nice-to-have, not required.
- Surface the `planner.component_skus` column too **only if S6 has already landed**; if not, omit it (do not add the metafield to the query in S1).

**Out of scope / do NOT touch:** No change to `shopifyNodeToProduct`, `renderProductPanel`, placement, quote, or any mesh. No dimension-parsing improvement (that is S2). No query changes. No new dependencies. When the param is absent, the code path must be inert (no perf cost, no extra fetch beyond the normal one — ideally reuse the products already loaded).

**Acceptance criteria:**
- `npm run dev`, open `http://localhost:5173/?catalogaudit=1` → console shows a table with one row per product and a summary group; every product with a real data problem is flagged with the exact fallback the planner would apply.
- Open the app **without** the param → byte-for-byte identical behaviour; no audit output, no extra work.
- No behaviour change to product panel, placement, or quote in either mode.

**How to test (Law L — starts with how to get it on screen):**
1. `git checkout main && git pull`, then check out this task's branch; `npm install` if needed; `npm run dev`.
2. Open `http://localhost:5173/?catalogaudit=1` in Chrome; open DevTools console. Confirm the table lists all products and the summary counts look right; spot-check one known-bad product (e.g. one that renders as a brown placeholder box) shows `glb→placeholder box`.
3. Open `http://localhost:5173/` (no param) → confirm no audit output and the panel/placement behave exactly as before.
4. Run the **AGENTS.md post-task smoke checklist** (desktop + touch).

---

## S2 — Robust dimension parsing + visible "default size" badge

**Objective (one sentence):** Make `shopifyNodeToProduct` parse plain-integer, decimal-string, and Shopify Dimension-type JSON metafield values (with mm/cm/m/inch → mm conversion), and show a visible "default size" badge in the product panel when dims are still missing — replacing today's silent `600×720×580` fallback.

**Board item (TASKS.md):** New item under **Track 1 (catalogue)** — "Robust dimension parsing" (`1.15b`). This is Item 1's planner-side fix; the Shopify data pass (`shopify-data` todo) is the owner's separate 👤 task, not this brief.

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.15b`.

**Files / functions / anchors to touch:**
- `main.js` `shopifyNodeToProduct` (~4611–4639), specifically the three parse lines at **4612–4614**:
  ```js
  const width  = parseInt(node.width_mm?.value)  || 600;
  const height = parseInt(node.height_mm?.value) || 720;
  const depth  = parseInt(node.depth_mm?.value)  || 580;
  ```
  Replace with a shared helper (e.g. `parseDimMm(rawValue)`) that handles: plain integer string (`"600"`), decimal string (`"600.0"`), numeric type, and Shopify **Dimension** JSON (`{"value":600.0,"unit":"MILLIMETERS"}`, also `CENTIMETERS`×10, `METERS`×1000, `INCHES`×25.4 → all rounded to mm). Return `null` when genuinely unparseable so the caller can decide the fallback + flag.
- Add a per-product flag on the returned object, e.g. `usesDefaultSize: true`, when any of the three dims fell back to the default constant. The default constants stay `600/720/580` (keep the visual/quote consistent), but the flag records that a fallback fired.
- `main.js` `renderProductPanel` badge block (**4721–4726**) — mirror the existing `'placeholder model'` badge pattern to add a `'default size'` badge when `product.usesDefaultSize` is true. Reuse the existing `.product-item-badge` class (do not invent new CSS classes/breakpoints).

**What it must NOT change:**
- **GLB scaling stays as-is** (`loadProductModel` per-axis scale at **1224–1239**). This brief only changes how dims are *read*, not how the GLB is scaled to them.
- Do not change the fallback default values (600/720/580) — a product with no data must still place at a sane size; the badge just makes the fallback visible.
- Do not change `PRODUCTS_QUERY`, placement, quote, or the `product` object's existing keys/shape beyond adding `usesDefaultSize`.

**Acceptance criteria:**
- A product whose `width_mm` metafield is Dimension JSON (`{"value":900,"unit":"MILLIMETERS"}`) now reads as `900`, not the `600` fallback (previously `parseInt` returned `NaN` → 600).
- A product with `"90"`+`"CENTIMETERS"` reads as `900`mm; `"0.9"`+`"METERS"` reads as `900`mm.
- A product with genuinely missing/garbage dims still places at `600×720×580` **and** shows a "default size" badge in the panel.
- Existing well-formed integer metafields behave exactly as before.

**How to test (Law L):**
1. `npm run dev`; open `http://localhost:5173/`. (Pair with S1: `?catalogaudit=1` makes it easy to see which products changed dims.)
2. In the product panel, confirm products that previously showed wrong (defaulted) sizes now show their real mm in the meta line (`W × D × H`), and products with no data show the new "default size" badge.
3. Place a corrected product → confirm the placeholder box / GLB is the corrected size and the quote/elevation dims match.
4. Run the **AGENTS.md post-task smoke checklist** (desktop + touch), paying attention to "cabinets sit on the 300mm slab" and elevation dims.

---

## S3 — Draft stash around OAuth sign-in

**Objective (one sentence):** Before the Google OAuth full-page redirect, stash the current scene JSON to `localStorage` if the scene is non-empty/dirty, and after boot (catalogue loaded + auth initialised) restore it via `loadScene()`, set `sceneDirty = true`, and clear the stash key.

**Board item (TASKS.md):** New item under **Track 1**, adjacent to open `1.7` login bridge — "Draft stash on sign-in" (`1.16a`). Item 3, part 1.

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.16a`.

**Root cause being fixed:** Sign-in is Google OAuth with a **full-page redirect** (`auth.js` `signInWithGoogle` 27–34, `redirectTo: window.location.origin`). The in-memory `walls`/`placedItems` die with the page. `serialiseScene()`/`loadScene()` (v3 plain JSON) are ready-made for a draft stash.

**Files / functions / anchors to touch:**
- `main.js` sign-in button wiring (**8133–8135**):
  ```js
  document.getElementById('btn-google-signin').addEventListener('click', () => {
    signInWithGoogle();
  });
  ```
  Before calling `signInWithGoogle()`, if `walls.length || placedItems.length || sceneDirty`, call `serialiseScene()`, take **only** `.sceneJson` (omit `thumbnail` — it's a large base64 dataURL and `localStorage` is small), and `localStorage.setItem('bbk_draft_signin', JSON.stringify(sceneJson))`. Wrap in try/catch (private mode / quota) exactly like the existing `bbk_autodesign` guard (7685–7689).
- `serialiseScene()` (7834–7927) — **read only**; call it, don't change it. Note it returns `{ sceneJson, thumbnail, skippedImportedCount }`.
- Boot sequence (**9396–9399**: `applyUrlMode(); initAuth(); animate();`) and the shared-project IIFE (**9401–9424**). Add the restore **after** products are available and auth is initialised, and **only when there is no `?share=`** (a shared read-only view must not be clobbered by a stashed draft). Products load via `loadShopifyProducts()` (async, called at 4760) — `loadScene()` needs `products` populated to resolve `item.productHandle` (see 8034). Gate the restore on the catalogue being ready (e.g. await/observe the same signal, or perform the restore inside the products-loaded continuation). **If wiring the "catalogue ready" signal cleanly requires changing `loadShopifyProducts`'s signature or adding a shared promise, stop and ask O first** — prefer an additive `window`-level ready flag/promise over a signature change.
- On successful restore: `loadScene(draft)` then set `sceneDirty = true` (so the user is reminded it's unsaved), then `localStorage.removeItem('bbk_draft_signin')`. Show a small toast (`showImportToast('Restored your unsaved design')`).

**What it must NOT change:**
- Do not change `serialiseScene`/`loadScene` shapes or the `scene_json` version. This brief only reads/writes an existing v3 JSON blob through `localStorage`.
- Do not alter `auth.js`'s `signInWithGoogle` (the redirect behaviour is correct). Do not touch RLS/Supabase.
- Do not stash the thumbnail. Do not restore when `?share=` is present.

**Interaction with S4:** S3 and S4 both write drafts to `localStorage`. Use a **distinct key** (`bbk_draft_signin`) so S3's sign-in stash and S4's autosave draft don't collide. On boot, sign-in restore (S3) takes precedence over the autosave resume prompt (S4): if a `bbk_draft_signin` key exists, restore it silently and clear it; only if it's absent does S4's "Resume?" prompt consider the autosave key. Note this ordering in the S4 build.

**Acceptance criteria:**
- Draw a room + place a cabinet (do not save) → click sign in with Google → complete OAuth → after redirect back, the room + cabinet are restored, the design shows as unsaved (dirty), and `localStorage.getItem('bbk_draft_signin')` is `null` afterwards.
- Empty scene → sign in → nothing stashed, no restore, no error.
- `?share=<slug>` in the URL → the shared project loads; no draft restore interferes.

**How to test (Law L):**
1. `npm run dev`; open `http://localhost:5173/`.
2. Draw a wall, place a cabinet, do NOT save. In DevTools Application → Local Storage, confirm `bbk_draft_signin` is written the moment you click "Sign in with Google" (before the redirect).
3. Complete Google OAuth. On return, confirm the scene is back, is marked unsaved, and the localStorage key is cleared.
4. Repeat on **iPad Safari** (touch) — OAuth redirect + restore must work there too.
5. Load `http://localhost:5173/?share=<a real slug>` → confirm the shared project shows and no draft restore fires.
6. Run the **AGENTS.md post-task smoke checklist** (desktop + touch).

---

## S4 — Debounced draft autosave + "Resume unsaved design?" prompt

**Objective (one sentence):** Autosave the scene draft to `localStorage` (debounced) on every `pushHistory`, and on a fresh load with a draft present (and no `?share=`), offer a "Resume your unsaved design?" prompt to restore or discard — keeping the existing `beforeunload` warning intact.

**Board item (TASKS.md):** New item under **Track 1** — "Draft autosave + resume prompt" (`1.16b`). Item 3, part 2.

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.16b`. **Build S3 first** (shared localStorage-draft mechanics and boot-ordering).

**Files / functions / anchors to touch:**
- `main.js` `pushHistory` (**299–305**) — after the existing body, trigger a **debounced** autosave (e.g. 800–1500ms trailing debounce via a module-scoped timer). The autosave calls `serialiseScene()`, takes `.sceneJson` only (omit thumbnail), and writes `localStorage.setItem('bbk_draft_autosave', JSON.stringify(sceneJson))`, wrapped in try/catch. Do **not** autosave when `readOnlyMode` is true or when `?share=` is present.
- Boot sequence (**9396–9424**) — on a fresh, non-shared load, if `bbk_draft_autosave` exists **and** S3's `bbk_draft_signin` does **not** (S3 wins, per its brief), show a non-blocking "Resume your unsaved design?" prompt with **Restore** and **Discard**. Restore → `loadScene(draft)` + `sceneDirty = true`. Discard → `localStorage.removeItem('bbk_draft_autosave')`. Use the existing modal/toast styling patterns (e.g. the refresh-confirm modal near 9769) rather than a raw `confirm()` if practical; a null-safe `confirm()` is acceptable for v1 if a modal is heavy. Any new button wiring uses the `if (el) el.addEventListener(...)` null-safe pattern.
- Clear `bbk_draft_autosave` on successful **Save Project** (the save flow around 9427–9439) and on explicit new/clear, so a saved design doesn't keep nagging. (If hooking the save-success path cleanly is non-trivial, at minimum clear it on Restore/Discard and overwrite it on the next `pushHistory` — flag any ambiguity to O.)
- **Keep the `beforeunload` warning** (**9774–9779**) exactly as-is.

**What it must NOT change:**
- No `scene_json` version/shape change. No change to `serialiseScene`/`loadScene`.
- Do not remove or weaken the `beforeunload` dirty warning.
- Debounce must not fire on every mouse-move; it hangs off `pushHistory` (discrete mutating actions), not render frames.

**Undo/redo note:** This brief adds **no** new mutating scene action — autosave is a side effect of `pushHistory`, not itself an undoable action — so there is no new `executeUndo`/`executeRedo` branch. Do not push a history entry from the autosave.

**Acceptance criteria:**
- Make several edits (each pushes history) → within ~1.5s of the last edit, `bbk_draft_autosave` in localStorage reflects the latest scene. Rapid edits produce **one** trailing write, not one per edit.
- Reload the page (dirty, unsaved) → "Resume your unsaved design?" prompt appears; **Restore** brings back the scene marked unsaved; **Discard** clears it and starts empty.
- Save the project → the autosave key is cleared; reloading does not nag.
- `?share=` load → no autosave, no resume prompt.
- The `beforeunload` warning still fires on close/refresh when dirty.

**How to test (Law L):**
1. `npm run dev`; open `http://localhost:5173/`.
2. Draw + place a few items; watch `bbk_draft_autosave` update in DevTools Application tab after you stop editing (confirm single debounced write).
3. Hard-reload → confirm the resume prompt; test both Restore and Discard.
4. Save a project → reload → confirm no prompt.
5. Confirm the browser's native "Leave site?" warning still appears on reload/close when there are unsaved changes.
6. Repeat Restore/Discard on **touch (iPad)**.
7. Run the **AGENTS.md post-task smoke checklist** (desktop + touch).

---

## S5 — Service products are quote-only (no 3D placeholder box) · scene_json v4

**Objective (one sentence):** Products with `planner.category = "service"` (e.g. Site Measure, Off-site Quotation) must never place a 3D placeholder box; they appear in the panel and are added as quote-only line items that flow into the quote panel, CSV, PDF, and Send-to-Cart — persisted via a new `serviceItems` array in `scene_json` at **version 4** with a migration for v1–v3, and full undo/redo for add/remove.

**Board item (TASKS.md):** New item, **Track 1 → touches Track 3's Send-to-Cart pipeline read-only** — "Service products quote-only" (`1.17`). Item 5. **Architecture-adjacent** (persisted-shape change) — this brief was designed by O; S implements exactly as specified and stops-and-asks on any deviation.

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.17`.

**⚠️ This is the one brief authorised to change `scene_json`.** Per **Law P** and AGENTS.md release discipline: bump the version, write the migration, and deploy reader + writer together in the same unit. A build that writes v4 must never coexist live with a build that can't read it. Do not split the reader and writer across two deploys.

**Files / functions / anchors to touch:**
- **Placement gate:** in `placeProduct` (~4763) and the panel click handler (`renderProductPanel`, the `div.addEventListener('click', () => placeProduct(product) ...)` at ~4731–4734), branch on `product.category === 'service'` (category is already derived in `shopifyNodeToProduct` at 4632). For a service product, do **not** create a mesh — instead call a new `addServiceItem(product)` that records a quote-only line and updates the quote. Keep the desktop and touch add paths in parity (both routes into placement must respect the service branch).
- **New state:** a module-scoped `let serviceItems = []` array of plain records (e.g. `{ productHandle, variantId, name, price, priceDisplay, skuIndex }`). This is **not** a mesh and is **not** in `placedItems`. Keep it separate so no three.js/dispose logic is implicated.
- **Undo/redo (mandatory):** `addServiceItem` and any remove path call `pushHistory({ type: 'add-service-item', data: {...} })` / `'remove-service-item'`, with matching branches added to **both** `executeUndo` and `executeRedo` (model them on an existing simple add/remove entry). Add/remove must round-trip cleanly. No meshes to dispose here — undo just splices the `serviceItems` array and calls `updateQuote()`.
- **Quote panel:** `updateQuote` (**4792–4808**) — include `serviceItems` prices in the total and render them as line items (a distinct sub-list or a "Services" group is fine; reuse `.quote-item` styling).
- **CSV export:** the `btn-export` handler (**5667–5694**) — append service lines to the CSV before the Total row.
- **PDF:** `buildQuoteRows` (**5540–5566**) — include service items as rows (qty/unit/total) so `buildQuotePDF` (5579–5665) prints them with no PDF-layout change.
- **Send-to-Cart:** the `btn-send-cart` handler (**5478–5535**) — add each service item's `variantId` to the `lineMap`/`lines` so it becomes a real cart line (same aggregation pattern; skip if no `variantId`, exactly like cabinets at 5489).
- **Persistence — `serialiseScene` (7834–7927):**
  - Bump `version: 3` → `version: 4` (line 7902).
  - Add a top-level `serviceItems: [...]` (plain JSON: `productHandle`, `variantId`, `skuIndex`, `price` — mirror what `loadScene` needs to rehydrate). Do **not** put service items into the `items` array (that array is mesh-backed and round-trips through `placeProduct`).
- **Persistence — `loadScene` (7990–8117):**
  - Accept versions `[1, 2, 3, 4]` (update the guard at **7991**).
  - **Migration:** v1–v3 saves have no `serviceItems` → treat as `serviceItems: []` (empty). This is lenient/forward-compatible, matching the existing v1→v2→v3 migration style (comments at 7898–7901 / 8013). Preserve the existing `cabinetYOffset` v1 migration untouched.
  - Rebuild `serviceItems` from `sceneJson.serviceItems` (resolve `productHandle` against `products` for name/price display), then `updateQuote()`. Restore must **not** pollute the undo stack (mirror the `skipHistory` discipline used for items at 8043).
  - Reset `serviceItems = []` in `clearScene` (7930–7988) alongside `walls`/`placedItems`.

**What it must NOT change:**
- Do not create any mesh, geometry, or material for service products — so there is nothing to dispose; do not touch `disposeModel`.
- Do not change the Track 3 order→Trade pipeline (`project_code`/`display_po` stamping at 5503–5516 stays exactly as-is; service items just become additional `lines`).
- Do not change the `items`/`walls`/`camera` shapes — `serviceItems` is purely additive at the top level.
- Do not change any function signature (`placeProduct`, `serialiseScene`, `loadScene`, `updateQuote`, `buildQuoteRows` keep their current signatures).

**Acceptance criteria:**
- Clicking a `category=service` product (e.g. Site Measure) adds it to the quote **without** placing any 3D box in the scene (nothing appears in the viewport; `placedItems` unchanged).
- The service item appears in the quote panel, CSV, and PDF, and is added as a cart line by Send-to-Cart (when it has a `variantId`).
- Add a service item → undo removes it from the quote → redo restores it.
- Save a scene with service items → reload → load → service items and quote total restored; no box appears.
- Load a legacy v1/v2/v3 save → loads clean with `serviceItems` empty, no error, everything else identical.
- `serialiseScene()` now emits `version: 4`.

**How to test (Law L):**
1. `git checkout main && git pull`; check out this task's branch; `npm run dev`; open `http://localhost:5173/`.
2. Ensure at least one product in Shopify has `planner.category = service` (Site Measure / Off-site Quotation). If none exists in the connected store, ask H to set one, or temporarily verify against `?catalogaudit=1` (S1) to find the category values — flag to O if no service product exists to test against.
3. Click the service product → confirm **no box** appears, but a quote line does. Check quote total, then export CSV and PDF and confirm the service line is present. Click Send to Cart → confirm the service variant is a cart line.
4. Undo → service line disappears from quote; Redo → returns.
5. Save the project, reload the page, load it → service item + total restored, still no box.
6. Load an older saved project (v1/v2/v3) → confirm clean load.
7. Confirm the v4 writer without a debug hook (`serialiseScene()` is NOT exposed on prod — the console hook was removed per Task Q): make an edit, then in DevTools → Application → Local Storage read `bbk_draft_autosave` and confirm `version: 4` + a `serviceItems` array; or inspect the saved project's `scene_json` in Supabase after Save. (On a dev build you may still call `serialiseScene()` directly.)
8. Repeat the add/undo flow on **touch (iPad)**.
9. Run the **AGENTS.md post-task smoke checklist** (desktop + touch) — pay special attention to "cabinets sit on the 300mm slab (place, save, reload)" and Quote CSV + PDF, since this brief touches quote + persistence.

---

## S6 — Component SKUs: multi-line cart + quote/CSV/PDF breakdown

**Objective (one sentence):** Add a `planner.component_skus` metafield (JSON `[{variantId, qty}]`) to the Storefront query so that Send-to-Cart expands a placed item into its component cart lines and the quote panel, CSV, and PDF show a per-item component breakdown — and surface `component_skus` in the S1 audit tool.

**Board item (TASKS.md):** New item under **Track 1 / Send-to-Cart** — "Component SKUs (multi-line)" (`1.18`). Item 2 / Sprint 2. **Build after Sprint 1 (S1–S5) is accepted.**

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief. State in one line that this maps to TASKS.md `1.18`.

**Architecture note (Opus decision, per the approved plan):** The frontend-only `component_skus` metafield is the chosen path (vs Shopify Bundles app / Cart Transform, which need an installed app + admin setup — deferred as the upgrade path). A placed item still maps to one primary variant; components are **additional** cart lines and quote/PDF/CSV breakdown rows. No variant-picker UI (everything uses variant 0 today) — out of scope.

**Files / functions / anchors to touch:**
- `main.js` `PRODUCTS_QUERY` (**4579–4607**) — add one metafield line, mirroring the existing ones:
  ```graphql
  component_skus: metafield(namespace: "planner", key: "component_skus") { value }
  ```
  This is an **authorised** additive query change (unlike S1, which was read-only). Do not touch the other query fields.
- `main.js` `shopifyNodeToProduct` (**4611–4639**) — parse `node.component_skus?.value` (JSON string) into `product.componentSkus = [{ variantId, qty }]` (default `[]`; try/catch the JSON parse, tolerate malformed → `[]` + a console warning). Keep every existing product key; this is additive.
- `main.js` Send-to-Cart `btn-send-cart` handler (**5478–5535**) — when aggregating `lineMap`, after adding the item's primary `sku.variantId`, also add each `componentSkus` entry (`variantId` × `qty × itemCount`) into the same `lineMap`. Preserve the existing skip rules (imported GLBs, openings, missing variantId) and the `project_code`/`display_po` stamping untouched.
- `main.js` `buildQuoteRows` (**5540–5566**) — add a component breakdown per placed item (e.g. child rows or an indented "includes:" sub-row). Keep the primary row shape so `buildQuotePDF` (5579–5665) still renders; if adding a `components` field to a row, make `buildQuotePDF` print them as extra table rows without changing column structure.
- `main.js` CSV `btn-export` handler (**5667–5694**) — emit a component sub-line per component under each item (clearly labelled), before the Total.
- `main.js` `updateQuote` (**4792–4808**) — optionally show the component breakdown in the on-screen quote panel (nice-to-have; PDF/CSV/cart are the acceptance bar).
- **S1 audit tool** — add a `component_skus` column/flag (present/absent + parsed count) to the report.

**What it must NOT change:**
- Do not change the primary one-item-one-variant model or add a variant picker.
- Do not change `scene_json` (components are derived from the product catalogue at export/cart time, not persisted per placed item — a placed item already stores its `productHandle`, and the product carries `componentSkus`). If you find yourself needing to persist components, **stop and ask O** (that would be a version bump and belongs with S5's mechanism, not here).
- Do not change the cart mutation, `project_code`/`display_po` stamping, or Supabase.
- Do not change function signatures.

**Acceptance criteria:**
- A product with a `planner.component_skus` metafield like `[{"variantId":"gid://shopify/ProductVariant/123","qty":2}]` places normally (one box), but Send-to-Cart produces the primary line **plus** 2× the component variant (×N placed).
- The quote PDF and CSV show the component breakdown under the parent item.
- A product with no/empty/malformed `component_skus` behaves exactly as today (no extra lines, no crash).
- `?catalogaudit=1` shows the `component_skus` status column.

**How to test (Law L):**
1. `npm run dev`; open `http://localhost:5173/`.
2. Ensure a test product has a valid `planner.component_skus` JSON value in Shopify (ask H to set one on a test product if absent; verify via `?catalogaudit=1`).
3. Place that product; export the PDF and CSV → confirm the component breakdown rows appear.
4. Click Send to Cart → on the Shopify checkout, confirm the component variants appear as their own lines with correct quantities (this step requires a real connected store — if the store isn't available, verify the `lines` array in the console before the redirect and note that live cart verification is pending H).
5. Place a product with no `component_skus` → confirm unchanged behaviour.
6. Repeat placement on **touch (iPad)**.
7. Run the **AGENTS.md post-task smoke checklist** (desktop + touch).

---

## S7 — Write `DIY-MODE-PLAN.md` (spec only, no code)

**Objective (one sentence):** Produce `DIY-MODE-PLAN.md` — a full spec (same shape as `AUTO-DESIGN-PLAN.md`) for a 5-step guided DIY wizard reusing the auto-design wizard chassis — for owner/Opus sign-off **before any DIY code is written**.

**Board item (TASKS.md):** New spec-first track alongside Track 2 — "DIY mode spec" (`DIY-1`). Item 4. **This is a documentation task: create one markdown file only. No `.js`/`.html`/`.css` changes.**

**Base / read first:** `main`. Read `AGENTS.md` + `ROLES.md` §S + this brief, plus `AUTO-DESIGN-PLAN.md` (for shape/format), `auto-design-wizard.js` (the modal chassis to reuse), and `auto-design-rules.js` (`NZ_BUILDING_RULES`, to be extended). State in one line that this maps to TASKS.md `DIY-1`.

**Deliverable:** `DIY-MODE-PLAN.md` at repo root, mirroring `AUTO-DESIGN-PLAN.md`'s structure (System Architecture / Phase Plan / Task Breakdown / Risk Register / Decisions / Sign-off Checklist). It must specify:
- **Entry & gate:** a DIY toolbar button + the same **hybrid role / query-param gate** pattern as auto-design (`computeAutoDesignEnabled` at 7691–7698; role-or-`?param=1`, default OFF, kill switch). Name the DIY equivalents (e.g. `?diy=1`, `window.DIY_ENABLED`).
- **Chassis reuse:** reuse the `auto-design-wizard.js` modal pattern (ctx API, step navigation, focus trap, 44px touch targets, body-scroll lock, existing 430/768 breakpoints) — spec how DIY plugs into it without forking the chassis.
- **Square-room start:** DIY begins from a default square room the user resizes (contrast with Free Draw).
- **Step 1 — wall lengths + ceiling height.**
- **Step 2 — doors / windows / power points** (reuse existing opening + GPO tools).
- **Step 3 — mood boards:** admin-manageable, seeded with the owner's **four launch palettes**. **Flag the storage decision as an owner ruling** — Supabase table vs Shopify metaobjects — with O's recommendation and a sensible default (Law H), but no build until H rules.
- **Step 4 — guided drag-drop** placement.
- **Step 5 — NZBC checker:** extend `auto-design-rules.js` `NZ_BUILDING_RULES` (currently hob-window only) with **G3/AS1 clearances**: min **800mm** clear space on the operational side, **600mm** with the oven door open, plus food-storage/refrigeration space. Spec these as new rule keys + warning messages, flagged `pending installer review` in the same manner as the existing NZBC values (`_meta.lastReviewed: null`).
- **Out of scope:** Free Draw multi-storey (note as future scope). Only Steps 1–2 are proposed for the first build round (per the plan's `diy-phase1` todo) — the rest ships after sign-off.
- **Sign-off gate:** explicit **Owner/Opus sign-off before any build** (ROLES.md — Opus turns the approved spec into S# briefs). No S# DIY build briefs are written until H approves this doc.

**What it must NOT do:** No code. No changes to `auto-design-*.js`, `main.js`, `index.html`, or `style.css`. No `TASKS.md` edit (the board amendment is proposed below; H/A applies). Do not invent that any DIY code exists — this is greenfield spec.

**Acceptance criteria:**
- `DIY-MODE-PLAN.md` exists at repo root, follows the `AUTO-DESIGN-PLAN.md` shape, and covers all five steps + gate + chassis reuse + NZBC G3/AS1 rules + mood-board storage owner-ruling flag + explicit sign-off gate.
- The mood-board storage decision is clearly marked as an **owner ruling** with a recommendation + default, not silently chosen.
- No code files changed.

**How to test (Law L — for a doc task, "on screen" = the rendered doc):**
1. Open `DIY-MODE-PLAN.md` in the editor's markdown preview.
2. Verify each required section is present and that the NZBC clearances (800mm operational / 600mm with oven door open) and the owner-ruling storage flag are explicitly called out.
3. Confirm `git status` shows only the new `DIY-MODE-PLAN.md` (no code files touched).
4. (No runtime smoke checklist — this brief ships no code. The smoke checklist applies to the later DIY build briefs, not to S7.)

---

## Board amendment — proposed additions to `TASKS.md`

> O proposes these lines. **Do NOT let S edit `TASKS.md` in plan mode** — H/A applies them when the work is executed/accepted (Law J: the board is updated at the end of every task). Numbering slots after the existing Phase 1 `1.x` items and adds a `DIY` track key.

Add under **Milestone B / Track 1** (catalogue + design-safety work, Items 0–5):

```
- [ ] ⬜ 1.15a Catalogue audit tool — ?catalogaudit=1 read-only report of missing/unparseable planner.* metafields + applied fallbacks (S1)
- [ ] ⬜ 1.15b Robust dimension parsing — integer/decimal/Dimension-JSON + unit conversion in shopifyNodeToProduct; visible "default size" badge (S2)
- [ ] 👤 1.15c Owner Shopify data pass — fix planner.* metafield types/values, populate unlinked products, split composite models (per public/catalog-setup.html) [owner task, not an S brief]
- [ ] ⬜ 1.16a Draft stash on OAuth sign-in — stash scene to localStorage before signInWithGoogle, restore after boot, sceneDirty=true (S3)
- [ ] ⬜ 1.16b Draft autosave + resume prompt — debounced localStorage autosave on pushHistory; "Resume your unsaved design?" on load; keep beforeunload (S4)
- [ ] ⬜ 1.17 Service products quote-only — planner.category=service become quote-only line items (no 3D box); scene_json v4 + v1–v3 migration; undo/redo (S5)
- [ ] ⬜ 1.18 Component SKUs — planner.component_skus expands Send-to-Cart into component lines; quote/CSV/PDF breakdown; surfaced in audit tool (S6) [Sprint 2]
```

Add a new track block for the DIY spec (spec-first, alongside Track 2):

```
## Track 5 — DIY guided mode (spec-first)  (spec: DIY-MODE-PLAN.md)
- [ ] 🧠 DIY-1 Write DIY-MODE-PLAN.md — 5-step wizard spec (square room; walls/ceiling; openings/GPOs; admin mood boards + 4 launch palettes; guided drag-drop; NZBC G3/AS1 checker). Reuses auto-design wizard chassis + hybrid gate. Mood-board storage (Supabase vs Shopify metaobjects) = owner ruling. Owner/Opus sign-off gate before any build. (S7)
- [ ] ⬜ DIY-2 After sign-off: DIY button + square room + Steps 1–2 only, reusing wizard modal + room/opening tools [blocked on DIY-1 sign-off]
```

> **Sequencing note for H/A:** build order is S1 → S2 → (owner `1.15c` in parallel) → S3 → S4 → S5, then Sprint 2 S6, with S7 (spec) doable any time but gated for sign-off before DIY-2. One reviewable unit per brief; A audits at each Sprint boundary and before the S5 `scene_json` v4 deploy (reader+writer together — Law P).
