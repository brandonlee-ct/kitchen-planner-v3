# Opus Design Brief — Part 2: Cabinet component bundles (parts list per cabinet)

> **What this is:** a paste-ready brief for **Opus (the architect)**. It asks for a *design ruling
> + build spec*, NOT code. An executor agent implements from Opus's spec afterward.
> Keep `AGENTS.md` and `MAIN_JS_COUPLING.md` open alongside it.
>
> **How to use:** paste the whole "Brief for Opus" section below into an Opus chat. Bring back the
> spec for review before any executor build prompt is written.

---

## Why this brief exists (PM context — read before pasting)

Today, one placed cabinet = exactly **one** Shopify variant in the cart and quote (the carcase
only). The benchtop and door panel are never added automatically. We want each cabinet to pull in
its related parts — **door/front, hardware, benchtop** — so "Send to Cart" and the quote produce a
complete itemised list. This mirrors how **Kaboodle (Bunnings)** and **IKEA** work: a cabinet on
screen is really a *kit* of separate component products (researched for comparison only, not copied).

Shopify must stay the **single source of truth** — component recipes live in Shopify metafields,
never hard-coded in `main.js`.

---

## Architectural principle for this work — and its honest limits

**Principle (apply to Part 2 and adopt going forward): new feature logic goes in its own isolated
module with a thin seam into the core, NOT inline additions to the `main.js` tangle.**

- `main.js` (~9750 lines) is a tightly-coupled core: `MAIN_JS_COUPLING.md` documents **~88 shared
  mutable globals** that legacy functions read/write directly. *Refactoring* that core is high-risk
  and is explicitly out of scope (and against house rules: "single file by design", "don't refactor
  working code — add to it").
- But **new** logic does not have to inherit that coupling. Part 2's "brains" — expanding a placed
  cabinet into a parts list — are **pure**: given `placedItems` + the loaded catalog, return the
  expanded cart lines / quote rows. That belongs in a **new module** (e.g. `components.js`), called
  from `main.js` through a couple of explicit function calls. Precedent already in the repo:
  **`auto-design.js`** is a separate file wired via a single `runAutoDesign()` seam.

**Honest limit (do not oversell this):** the isolated-module pattern works for *logic/data*
features (components/pricing, export, auto-design). It does **not** rescue features that are
intrinsically wired into the scene graph, render loop, or input system — e.g. realistic
lighting/materials, first-person walkthrough, gamepad input. Those will still add code to the core,
and `main.js` will keep growing somewhat regardless. The policy reduces tangle where it can; it is
not a universal escape hatch. Opus should confirm this framing and say where the seam belongs.

---

## Brief for Opus  (paste from here ↓)

**Role:** You are the architect for the Brown Box Kit 3D kitchen planner (three.js + vanilla JS,
single `main.js` ~9750 lines, Vite, Shopify Storefront API for catalog, Supabase for auth/projects,
frontend-only except the Supabase SDK). I need a **design ruling + build spec**, not code. An
executor agent will implement from your spec afterward.

### Goal
Make each placed cabinet automatically include its related parts (door/front, hardware, benchtop)
so **Send to Cart** and the **quote PDF** produce a complete itemised list. Shopify stays the single
source of truth — component recipes are managed in Shopify metafields, never hard-coded.

### Current code facts (so the spec fits the real seams)
- **Catalog fetch** (`PRODUCTS_QUERY`, ~`main.js:4510`): reads `planner.*` metafields —
  `glb_url`, `width_mm`, `height_mm`, `depth_mm`, `category`. `shopifyNodeToProduct()` maps each
  node → `{ id(handle), shopifyId, name, productType, category, modelPath, width, height, depth,
  skus[] }`, where each sku is `{ id(sku||variantId), label, price, priceDisplay, variantId,
  available }`. Products are fetched once at load into the module-level `products` array.
- **Placement:** each placed mesh has `userData = { product, skuIndex: 0 }`.
- **Send to Cart** (`btn-send-cart` handler, ~`main.js:5364`): aggregates `variantId → quantity`
  over `placedItems`, builds `lines: [{ merchandiseId: variantId, quantity }]`, runs the
  `cartCreate` mutation, redirects to `cart.checkoutUrl`. Skips `imported-*` products and
  `door/window/gpo` opening meshes.
- **Quote** (`buildQuoteRows()`, ~`main.js:5411`): aggregates by `variantId` into rows
  `{ name, variant, qty, unitPrice, total }`; feeds the jsPDF quote.
- **Save/load** (`scene_json` **v3**, serialize ~`main.js:7574`): items store
  `{ productHandle, variantId, position, rotationY, skuIndex }`; `loadScene()` rebuilds. House rule:
  any `scene_json` shape change requires a version bump + a migration for older saves, and
  reader+writer must deploy together.

### Hard constraints (from AGENTS.md + MAIN_JS_COUPLING.md)
- The `planner.*` metafield namespace and the `scene_json` shape are architecture decisions — that
  is why this is coming to you.
- Don't break undo/redo, touch+mouse parity, or the GLB dispose pattern. Frontend-only except the
  Supabase SDK. Don't refactor working code; add to it.
- **Isolation requirement:** put the new component-expansion logic in its **own module** (suggest
  `components.js`) as **pure functions** that take `(placedItems-or-derived, products)` and return
  cart lines / quote rows. `main.js` should change only at thin call sites (the cart line-builder
  and `buildQuoteRows` call into the module). Do **not** add the expansion logic inline into the
  core or have it reach into the ~88 shared globals. Mirror the `auto-design.js` / `runAutoDesign()`
  seam precedent. If you disagree this is the right seam, say so and propose the alternative.

### Decisions I need from you (my recommended defaults — ratify or override, with reasoning)

1. **Component metafield schema.** Propose the exact shape of a new `planner.components` metafield
   (JSON). *My default:* a list of `{ ref, qty, rule }` where `ref` is the component's **variant
   GID** (stable; maps straight to `merchandiseId`; no lookup) and `rule` is `"per_cabinet"` or
   `"per_length"`. Trade-off to rule on: variant GID (robust but opaque to whoever edits Shopify)
   vs SKU code (human-friendly but needs a SKU→variantId map built from the loaded catalog). Pick
   one, justify, and give a worked example value.

2. **Benchtop / length-based parts.** Benchtop isn't 1-per-cabinet (three 600 mm cabinets in a row
   share one 1800 mm benchtop). *My default:* keep benchtop **out of Phase A**; Phase A auto-adds
   only `per_cabinet` parts (door + hardware). Define the `per_length` rule for a **Phase B** that
   ties into the planned auto-benchtop feature (roadmap 2.7): specify how length is summed across a
   run and rounded (per-mm? to stock lengths? how are corners/returns handled?). Confirm or
   restructure this phasing.

3. **Does `scene_json` change?** *My default:* **No.** Components are re-expanded from the **live**
   product metafields at cart/quote time, keyed off the already-saved `productHandle` — so no
   version bump, no migration, and Shopify stays source-of-truth (editing a recipe updates existing
   saved designs on reload). Confirm this is acceptable, or specify the migration if you instead
   want components frozen into the save (and the trade-off that implies).

4. **Quote/cart presentation.** *My default:* show components as **separate itemised lines**
   (Kaboodle-style transparency) in both the cart and the quote PDF, grouped under/after their
   parent cabinet. Confirm, or specify rolling them into a single cabinet price.

5. **Edge cases — specify required behaviour for:** component variant missing/unpublished
   (skip + which warning?), component out of stock (`availableForSale === false`), the same
   component shared across multiple cabinets (aggregate correctly), imported GLBs (no components),
   and a cabinet with no `planner.components` (MUST behave exactly as today — carcase only, zero
   regression).

6. **UI scope.** Is per-cabinet component visibility/toggle (IKEA-style "remove the door, keep the
   hinges") in scope, or strictly auto-include for MVP? *My default:* auto-include only for Phase A;
   defer any toggle UI.

### Deliverable I want back from you
A tight build spec an executor can follow:
- (a) final `planner.components` JSON schema + a worked example;
- (b) the new module's public API (function names + signatures) and exactly which `main.js` call
  sites change (the cart line-builder; `buildQuoteRows`; and whether `PRODUCTS_QUERY` /
  `shopifyNodeToProduct` must read+attach the new metafield, or whether the module fetches it);
- (c) the expansion algorithm — `per_cabinet` for Phase A; `per_length` defined for Phase B;
- (d) the `scene_json` verdict (and migration if any);
- (e) edge-case handling per the list above;
- (f) the Phase A vs Phase B split;
- (g) smoke-test additions for the post-task checklist;
- (h) a one-line ruling on whether to add a "new features as isolated modules + thin seam" rule to
  `AGENTS.md` (see proposal below), and the exact wording if yes.
- Flag anything that secretly needs a backend or breaks a listed constraint.

### Proposed AGENTS.md addition for you to ratify/reword
> **New-feature modularity (added Part 2):** New feature *logic* should live in its own module with
> a thin, explicit seam into `main.js` (precedent: `auto-design.js` ↔ `runAutoDesign()`), not inline
> additions that reach into the shared module-scoped state. This applies to logic/data features
> (pricing, export, component expansion). It does NOT apply to features intrinsically coupled to the
> scene graph / render loop / input system (lighting, materials, walkthrough, gamepad), which will
> still extend the core. Never refactor the existing core to achieve modularity — only add new code
> this way.

## (paste to here ↑)

---

## After Opus responds (PM checklist)
- Review the spec here together before writing the executor build prompt.
- Confirm the `planner.components` schema is something Tommy can fill in via the SOP's Part B
  spreadsheet (keep it human-manageable in Shopify).
- If Opus ratifies the AGENTS.md addition, apply it in a small separate commit.
- Then I (PM) turn the spec into an executor build prompt for **Phase A** (door + hardware
  auto-add); Phase B (benchtop by length) follows.
