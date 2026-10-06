# S Brief — C9: out-of-stock badge + pre-cart warning

> **Author:** `O-opus-06oct26` — O, PM (Opus, subagent in H's local Cursor session, 6 Oct 2026).
> **Problem, acceptance criteria and gates:** defined by A (ruling of 21 Aug 2026: options 1 + 2
> GRANTED, option 3 REJECTED). They are written on the `TASKS.md` `C9` line, and this brief designs
> against them; it does not re-derive them. **Solution design and this brief:** O.
> Written against `main` @ `c812c64` (+ the 6 Oct docs commit), read at file level.

## Delegation template (Law G — ROLES.md §O, verbatim fields)

```
Base: main, current and pulled (do NOT stack on unmerged work).
Read first: AGENTS.md + ROLES.md §S + this brief. State in one line which TASKS.md
  item this maps to.
Task (one deliverable): C9 — show an "out of stock" badge on unavailable products in the
  catalogue panel, and warn (confirm, never block) before Send to Cart when the cart would
  contain lines Shopify reported as unavailable at catalogue load.
In scope: main.js only — renderProductPanel (one badge, beside the existing
  'placeholder model' / 'default size' badges) and the btn-send-cart click handler (one
  pre-flight check after lineMap is built, before the button is disabled and before
  cartCreate), plus at most one small new helper function for the availability lookup.
Out of scope / do NOT touch: index.html, style.css, auth.js; scene_json / serialiseScene /
  loadScene; pushHistory / executeUndo / executeRedo and every history entry; placeProduct
  (NO placement gate — option 3 is REJECTED); the catalogue fetch / PRODUCTS_QUERY (no new
  field — availableForSale is already fetched); shopifyNodeToProduct; the cartCreate input,
  the project_code / display_po attributes, the pageshow (C3) handler; hiding OOS products
  (that is 1.19's mechanism, a different intent); backorder / lead-time UX; any Shopify
  setting.
Definition of Done: runs end-to-end, one demoable function, exercised in the target
  role/context/device, "how to test" note included, build passes.
Stop and ask before: schema/RLS/data-migration changes, shared or cross-system
  contract changes, new secrets/vendors, architecture/auth/security decisions,
  anything contradicting the docs.
Output: one small reviewable unit off main, then stop.
```

**Board item:** `TASKS.md` → 🔴 Bug brief **`C9`**.
**Sequencing condition ("brief after 1.19 lands"): satisfied.** 1.19 is on `origin/main` `c812c64`
(pushed 30 Sep 2026) and in the live bundle. Both C9 touch-points sit in code 1.19 already changed,
so build on current `main`.

**Brief-specific stop-and-ask (in addition to the template):** stop if the work seems to need a
`scene_json` field, a history entry, a change to any function signature, a new CSS class or
breakpoint, or a change to *which lines are sent to the cart*. The warning must never add, drop or
re-quantify a line.

---

## 1. The problem (A's statement, verified by O at file level, 6 Oct)

Shopify rejects the **whole cart** when it refuses one line. So a customer can design a complete
kitchen, click `🛒 Send to Cart`, and land on a checkout that shows an "Out of stock" dialog, with no
warning anywhere in the planner. The data needed to warn them is already loaded and nothing reads it:

- `shopifyNodeToProduct` (`main.js`, `// ── … ──` Shopify section) maps each variant's Shopify
  `availableForSale` onto **`sku.available`**:
  `available: v.availableForSale`. A product with no variants gets one fallback sku
  `{ id, label: 'Standard', price: 0, …, available: false }` **with no `variantId`**.
- `renderProductPanel` renders `placeholder model` (when `!product.modelPath`) and `default size`
  (when `product.usesDefaultSize`) badges, both `div.product-item-badge`, appended to the item's
  `body`. Nothing renders availability.
- The `btn-send-cart` click handler builds `lineMap` (`variantId → qty`) from three sources:
  placed items (`obj.userData.product.skus[skuIndex ?? 0].variantId`), their 1.18 component lines
  (`resolveComponentLines(product)`), and `serviceItems` (`si.variantId`). It then disables the
  button, calls `cartCreate`, and redirects. No availability check exists anywhere on that path.

**On today's live data this matters more, not less.** A's 6 Oct read-only Storefront observation
(RELAY.md, 6 Oct entry; the figures are relay-only and must not be copied to `TASKS.md`) found
**218 of 227 products `availableForSale = false`**. In practice, **nearly every cart will trigger the
warning**. The copy must therefore be calm and plain, and the dialog must be a speed bump, not a wall.
One tap continues to checkout.

## 2. Acceptance criteria (A-set — copied from the `C9` board line, do not re-derive)

1. **No placement gate.** A design containing out-of-stock items must still place, save, load,
   quote, export CSV and export PDF exactly as today.
2. **No `scene_json`, history-entry or undo/redo change.** Display plus one pre-flight check only.
3. **Copy says "may be".** Availability is captured at catalogue load and can go stale in a long
   session, so the warning says items **may be** out of stock. **Shopify's checkout remains the
   authority.**
4. **Never silently drop a line.** The quote total stays truthful either way. The cart sent after
   "Continue" is byte-for-byte the cart that would have been sent before this change.
5. **Badge:** driven by the existing `sku.available` (no new fetch, no new field), beside the existing
   badges, display-only, identical for touch and mouse (both input paths render the same element).
6. **Out of scope:** the Shopify setting (already correct — ruled 21 Aug), backorder/lead-time UX, and
   hiding OOS products from the catalogue.

## 3. Design

### 3a. Option 1 — catalogue badge (`renderProductPanel`)

Directly after the existing `default size` badge block, add a third badge in the same style:

- Consider only skus that can actually reach a cart: `const cartable = product.skus.filter(s => s.variantId)`.
  This keeps the variant-less fallback sku, which is `available: false` by construction, from
  badging a product that can never be carted anyway.
- If `cartable.length > 0` **and every** cartable sku has `available === false` → badge text
  **`out of stock`**.
- Else if **some** (not all) cartable skus have `available === false` → badge text
  **`some options out of stock`**.
- Otherwise no badge. Test with `=== false` strictly: an `undefined` from an unexpected payload
  must not produce a badge (never invent a state).
- Same element and class as its neighbours: `div.product-item-badge`, appended to `body`. **No new
  CSS class and no `style.css` edit.** The click handler on the item is untouched, so placing still
  works (criterion 1).

Touch and mouse parity is structural: there is one panel render for both input paths.

### 3b. Option 2 — pre-cart warning (`btn-send-cart` handler)

**Where:** after the existing `if (lineMap.size === 0) { … return; }` guard, and **before**
`const lines = …` / `btn.disabled = true`. Cancelling must leave the button enabled and labelled
`🛒 Send to Cart`. That ordering also leaves the C3 `pageshow` reset untouched.

**What it checks:** the keys of the **already-built `lineMap`**. Checking the map, rather than
re-walking `placedItems`, covers placed items, 1.18 components and `serviceItems` with one rule,
and guarantees the check describes exactly the lines about to be sent.

**Lookup:** one small new helper, e.g. `findUnavailableCartLines(lineMap)`. It builds a
`variantId → { name, label, available }` map from **`products`** (the same source
`getComponentVariantIndex` reads; do **not** modify that function or its index shape). It returns
`[{ name, label, qty }]` for every `lineMap` entry whose variant is found **and** has
`available === false`. A variantId **not found** in `products` is **not** reported, because the
planner cannot know its stock and must not invent one; Shopify decides at checkout.

**Dialog:** native `confirm()`. There is precedent in `main.js`: the auto-design replace, project load
and project delete flows already use it. Copy (singular/plural handled):

```
2 items may be out of stock:

• #1 Base Cabinet 150mm (×2)
• Hinges 110° (×4)

Stock is confirmed at checkout. Continue to checkout anyway?
```

- First line: `N item(s) may be out of stock:` where **N = number of affected cart lines** (distinct
  variants), matching A's ruling wording ("N items may be out of stock. Continue to checkout anyway?").
- List each affected line as `• <name>` plus ` — <label>` when the label is not `Standard`, plus
  ` (×qty)`. **Cap the list at 8 lines**, then `…and K more`. On today's data a long cart could
  otherwise produce a dialog taller than an iPhone screen.
- Last line, verbatim: `Stock is confirmed at checkout. Continue to checkout anyway?`
- No exclamation marks, no "error", no red. It is a heads-up.

**Outcomes:**
- **OK** → continue with the existing code exactly as-is: same `lines`, same attributes, same
  `cartCreate`, same redirect.
- **Cancel** → `return` before anything is disabled. No toast, no state change, no history entry,
  no change to the plan or the quote.
- **No affected lines** → no dialog at all; behaviour identical to today.

Do **not** log every affected line with `console.warn` on each click. One `console.log` line with the
count is fine (readable via eruda on iPad).

### 3c. Why not the other obvious designs (for the reviewer)

- *Remove OOS lines from the cart automatically:* violates criterion 4 (silent drop), and makes the
  cart total disagree with the quote/CSV/PDF.
- *Block Send to Cart:* that is option 3 by another route, and it was rejected.
- *Re-query stock before cartCreate:* new fetch, new latency on the revenue path, and still stale by
  checkout. Shopify is the authority (criterion 3).
- *In-page modal instead of `confirm()`:* needs `index.html` + `style.css` changes, which are out of
  scope. `confirm()` is the house precedent.

## 4. Risks S must check, not assume

1. **Embed mode (`?embed=1`, item 1.6).** If the planner is ever framed with a `sandbox` attribute
   that lacks `allow-modals`, `confirm()` returns `false` immediately and the customer could never
   reach checkout with an OOS item. That would be a revenue-path regression. **Test `?embed=1`.** If
   `confirm()` does not show there, **stop and ask** rather than inventing a workaround.
2. **INSTALL QUOTE REQUEST** (`planner.category = service`, a $0 line). If Shopify reports it
   unavailable, it will be badged and listed. That is truthful, so do not special-case it. Report
   what you saw in the test note.
3. **Imported GLBs and openings** are already excluded from `lineMap` by the existing handler, so they
   can never be listed. Do not add a second exclusion.

## 5. Definition of Done (brief-specific additions)

- All six acceptance criteria above hold.
- A design with OOS items saves, reloads (draft autosave and Supabase save/load), quotes, and exports
  CSV + PDF with totals identical to the pre-change build.
- The cart sent after OK is identical to the pre-change cart (compare the `lines` array in DevTools →
  Network → the `cartCreate` request payload).
- `npm run build` passes; the reviewer subagent has run; the "how to test" note is included.
- `TASKS.md` `C9` → `- [ ] ⏳` on push/deploy, ✅ **only** after H live-verifies (board convention).
- Full `AGENTS.md` post-task smoke checklist, desktop **and** touch.

## 6. How to test (Law L — starts with getting the new code on screen)

1. **Get the build on screen.** In `C:\dev\kitchen-planner-v3`: `git fetch origin`, then
   `git checkout <S's branch or main after merge>`, then `git pull`, then `npm ci --include=optional`
   (on a fresh clone a plain `npm install` can omit jspdf's optional `canvg` and break the build),
   then `npm run dev`. Open the printed URL (normally `http://localhost:5173/`). The dev server talks
   to the **live** Shopify Storefront, so today's real stock data is what you will see. On a phone or
   iPad add `?debug=1` for the on-screen eruda console. **On the live site** (after H merges and
   Vercel deploys `main`), open `https://planner.brownboxkit.co.nz` instead.
2. **Badge.** Open the catalogue panel. *Expect:* most products show an `out of stock` badge next to
   any `placeholder model` / `default size` badges. The few in-stock products show none. A product
   with mixed variants (if any exist) shows `some options out of stock`.
3. **No placement gate.** Click an `out of stock` product. *Expect:* it places normally and appears in
   the quote at its normal price.
4. **Warning — Cancel.** With that OOS cabinet placed, click `🛒 Send to Cart`. *Expect:* a dialog
   reading `1 item may be out of stock:` naming it, ending
   `Stock is confirmed at checkout. Continue to checkout anyway?`. Click **Cancel**. *Expect:* you stay
   in the planner, the button is green and reads `🛒 Send to Cart`, and the plan and quote are unchanged.
5. **Warning — OK.** Click `🛒 Send to Cart` again → **OK**. *Expect:* you reach the Shopify checkout,
   which shows its own out-of-stock message. That is expected and correct: Shopify is the authority.
6. **No warning when in stock.** Restart Planner, place only products with **no** badge, then Send to
   Cart. *Expect:* no dialog; straight to checkout, exactly as before.
7. **Long list.** Place 10+ different OOS products and Send to Cart. *Expect:* 8 names then
   `…and K more`, and the dialog fits on an iPhone screen.
8. **Truthful totals.** With OOS items placed, export CSV and PDF and compare totals with the on-screen
   quote: all three agree, as before.
9. **Persistence.** Save the project, Restart Planner, load it. *Expect:* the OOS items are still there.
   Reload the tab and accept "Resume your unsaved design?" *Expect:* the same.
10. **Back from checkout (C3 still fixed).** After step 5, press browser **Back**. *Expect:* the button
    reads `🛒 Send to Cart` and works.
11. **Touch.** Repeat steps 2–5 on an iPad/iPhone, or in a 390px-wide window with touch emulation.
    *Expect:* identical badge and dialog.
12. **Embed.** Open `?embed=1` and repeat step 4 (see risk 1).
13. Run the full `AGENTS.md` post-task smoke checklist, desktop **and** touch.
