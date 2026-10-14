# S Brief — F1 + C6: CSV image column and field escaping

> **Author:** `O-opus-12oct26` — O, PM (Opus, H's local Cursor session; brief written 14 Oct 2026).
> **Board items:** `TASKS.md` → Future scope **`F1`**, with **`C6`** folded in (H ruling (c), 12 Oct 2026).
> **Programme slot:** F programme **M3** (brief). The build is **M4**, and it does not start until `C9` is
> live-verified by H (one S unit in flight). This brief may be written early per A's 12 Oct gate ruling.
> Written against pushed `main` @ `29444e2` (contains C9 `82cb385`), read at file level.

## Delegation template (Law G — ROLES.md §O, verbatim fields)

```
Base: main, current and pulled (do NOT stack on unmerged work).
Read first: AGENTS.md + ROLES.md §S + this brief. State in one line which TASKS.md
  item this maps to.
Task (one deliverable): F1 + C6 — the quote CSV gains an image URL column, and every
  CSV field passes through one escaping helper (quotes doubled; a leading = + - @ tab or
  CR neutralised), so a product name can neither break a field nor run as a formula.
In scope: main.js only — the btn-export click handler, plus ONE new helper function
  (csvCell) placed directly above it.
Out of scope / do NOT touch: the PDF (buildQuotePdf, buildQuoteRows, btn-export-pdf);
  updateQuote and every on-screen total; serviceItems records, scene_json /
  serialiseScene / loadScene (no new field on any persisted record); pushHistory /
  executeUndo / executeRedo; resolveComponentLines, getComponentVariantIndex;
  shopifyNodeToProduct / PRODUCTS_QUERY (imageUrl is already fetched); which rows the
  CSV contains (do not add or skip rows); the UTF-8 BOM, the MIME type, the file name
  kitchen-quote.csv, and the download mechanics; index.html, style.css, auth.js;
  package.json (no new dependency).
Definition of Done: runs end-to-end, one demoable function, exercised in the target
  role/context/device, "how to test" note included, build passes.
Stop and ask before: schema/RLS/data-migration changes, shared or cross-system
  contract changes, new secrets/vendors, architecture/auth/security decisions,
  anything contradicting the docs.
Output: one small reviewable unit off main, then stop.
```

**Brief-specific stop-and-ask:** stop if the work seems to need a field on a persisted record (a
service item, a placed item's saved data), a change to `buildQuoteRows`, a new npm package (for example
an XLSX writer), or any change to which lines appear in the CSV.

---

## 1. The problem (verified by O at file level, 14 Oct)

The `btn-export` handler (`// ✅ FIX 2: export quote as CSV`, `main.js` ~6284) writes three columns with
template strings:

```
Product,Variant,Price
"<product.name>","<sku.label>",<sku.price.toFixed(2)>
"  ↳ Includes: <c.name>","<c.label || 'Component'> × <c.qty>",<compTotal.toFixed(2)>
"<si.name>","<si.skuLabel>",<si.price.toFixed(2)>
"","Total","<total.toFixed(2)>"
```

- **C6 (quoting).** Names are interpolated raw inside `"…"`. A name containing `"` closes the field early,
  so every column after it shifts.
- **C6 (formula injection).** A field starting with `=`, `+`, `-` or `@` is evaluated as a formula by Excel
  and Google Sheets. Product names come from Shopify, and imported-model names come from the **file name**
  (`glbModalFile.name`), so the customer controls them.
- **F1.** There is no image column. Shopify products already carry `imageUrl` (`featuredImage.url`,
  mapped in `shopifyNodeToProduct`), and nothing in the CSV uses it.

**⚠ What "IKEA-style" can and cannot mean in a CSV (H, read this).** A `.csv` file holds text only. It
**cannot embed pictures**. The new column will hold each line's image **link** (a `https://cdn.shopify.com/…`
URL). Excel and Sheets show it as text. In Google Sheets the reader can type `=IMAGE(D2)` in a spare column
to see the picture; the planner will **never write that formula itself**, because a planner-written
formula is exactly what the escaping in this brief exists to block. **If H wants pictures to appear inside
the spreadsheet when it opens, that needs an `.xlsx` export, which means a new library — a new vendor
dependency, and therefore a hard stop for a separate H decision.** This brief does not do that.

## 2. Acceptance criteria

1. **Existing columns byte-identical** for ordinary data. For a design whose names contain none of
   `"` `=` `+` `-` `@` (at the start), tab or CR, every existing cell is byte-for-byte what the pre-change build
   writes. The only differences are `,Image URL` on the header and one extra trailing cell on each row.
2. **BOM kept.** The file still starts with `\uFEFF`, the MIME type is unchanged, and the file is still
   `kitchen-quote.csv`.
3. **Escaping on every data field.** Every cell written for a data row goes through `csvCell`. A `"`
   in a value is doubled (`""`), and the field stays one cell.
4. **Formula neutralised.** A value starting with `=`, `+`, `-`, `@`, tab (`\t`) or CR (`\r`) is written with a
   leading apostrophe (`'`) inside the quotes, so it opens as text, never as a formula. (Tab and CR are added
   to H's list because they are the other two OWASP CSV-injection lead characters. They cost nothing.)
5. **Image column.** Each placed item, component line and service line carries its product's `imageUrl`,
   or an empty cell when there is none. The Total row's image cell is empty. Imported models get an empty
   cell. **Never** write an imported model's `thumbnail`: it is a `data:` URL tens of kilobytes long.
6. **Opens cleanly in Excel and Google Sheets:** four columns, every row aligned, the `↳` marker readable
   (BOM), and prices still read as numbers.
7. **Nothing else changes:** no PDF change, no on-screen total change, no `scene_json` or history change, and
   the row set is identical (same rows, same order).

## 3. Design

### 3a. The helper — `csvCell(value)`

Directly above the `btn-export` handler, under its own header
`// ── Quote CSV: field escaping (C6 / F1) ──`:

```js
function csvCell(value) {
  if (typeof value === 'number') return value.toFixed(2);
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
```

- **Numbers stay bare**, which is how prices are written today (`117.30`, unquoted). A number cannot carry
  a formula, so it needs no escaping. Shopify prices are never negative, so a bare `-` cannot occur.
- **Strings are always quoted**, which is how names and labels are written today.
- **The byte-identical rule follows from this.** For an ordinary name, `csvCell(name)` is exactly
  `"name"`, which is what the template string writes now.

### 3b. Call sites — exactly this mapping, nothing else

| Row | Product cell | Variant cell | Price cell | **Image URL cell (new)** |
|---|---|---|---|---|
| Header | literal `'Product,Variant,Price,Image URL'` — a constant, not data, so it stays a bare literal | | | |
| Placed item | `csvCell(product.name)` | `csvCell(sku.label)` | `csvCell(sku.price)` (number → bare) | `csvCell(product.imageUrl \|\| '')` |
| Component | `csvCell('  ↳ Includes: ' + c.name)` | `csvCell((c.label \|\| 'Component') + ' × ' + c.qty)` | `csvCell(compTotal)` (number → bare) | `csvCell(imageForVariant)`, see below |
| Service | `csvCell(si.name)` | `csvCell(si.skuLabel)` | `csvCell(si.price)` (number → bare) | `csvCell(imageForHandle)`, see below |
| Total | `csvCell('')` | `csvCell('Total')` | `csvCell(total.toFixed(2))` (**string** → quoted, as today) | `csvCell('')` |

Join the cells of each row with `,`. The component Product cell is composed **before** escaping, so the
helper sees the whole string. It starts with spaces, so it never gets the apostrophe, and today's bytes are
kept.

**Image lookups, inline (no second helper, no new index):**
- **Component:** `products.find(p => p.skus.some(s => s.variantId === c.variantId))?.imageUrl || ''`.
  An unknown component (resolved as "Unknown component …") finds nothing → empty cell. Never invent a URL.
- **Service:** `products.find(p => p.id === si.productHandle)?.imageUrl || ''`. Service records do **not**
  carry `imageUrl`, and adding it would change a persisted record (forbidden). Look it up instead.
- **Placed item:** `product.imageUrl || ''`. `loadScene` restores items through `placeProduct`, so
  `userData.product` is the catalogue product and has `imageUrl` when Shopify has one. Imported models
  have no `imageUrl` → empty cell.

Keep the existing `// ✅ FIX 2` header, the 1.18 comments and the BOM comment. Do not restructure the handler.

### 3c. Rejected designs (for the reviewer)

- *Quote every cell, numbers included:* simpler, but it changes the bytes of every price cell, which breaks
  criterion 1.
- *Prefix with a space or tab instead of `'`:* the apostrophe is the OWASP-recommended neutraliser, and both
  Excel and Sheets treat it as text.
- *Write `=IMAGE(url)` so Sheets shows pictures:* that is the formula injection C6 removes, done
  deliberately. No.
- *XLSX with embedded images:* a new dependency. That is a hard stop, see §1.

## 4. Risks S must check, not assume

1. **Apostrophe display.** Excel shows a CSV-imported `'=1+1` with the apostrophe visible. Sheets may hide
   it. Either is a pass. The pass condition is that the cell shows **text**, never the result `2`. Report
   what each one showed.
2. **Excel regional settings.** In locales where `;` is the list separator, Excel may open any CSV in one
   column. That is pre-existing and unchanged by this brief. If it happens, note it in the test note; do
   not change the separator.
3. **A `"` in a live name is hard to produce on Windows**, because Windows file names cannot contain `"`.
   S must prove the `"` case with the controlled check in §6 step 3. H's live check covers `=`, `+`, `-`
   and `@` through an imported model's file name.

## 5. Definition of Done (brief-specific additions)

- All seven acceptance criteria hold.
- **Byte comparison done:** the same ordinary design is exported from the pre-change build and the new
  build. The files differ only by the header suffix and the one trailing cell per row. Report the method
  (for example, a diff with the image column stripped).
- **Helper case table run:** S runs `csvCell` against the cases below in a throwaway script, **not
  committed**, and reports pass/fail per case.

  | Input | Expected output |
  |---|---|
  | `'Base 600'` | `"Base 600"` |
  | `'24" Base'` | `"24"" Base"` |
  | `'=1+1'` | `"'=1+1"` |
  | `'+64 21'` | `"'+64 21"` |
  | `'-5'` | `"'-5"` |
  | `'@SUM(A1)'` | `"'@SUM(A1)"` |
  | `'\tx'` | `"'\tx"` |
  | `'  ↳ Includes: =x'` | `"  ↳ Includes: =x"` |
  | `''` / `null` / `undefined` | `""` |
  | `117.3` (number) | `117.30` |
  | `'117.30'` (string) | `"117.30"` |

- `npm run build` passes, the reviewer subagent has run, and the "how to test" note is included.
- `TASKS.md` `F1` and `C6` become `- [ ] ⏳` on push/deploy, and ✅ **only** after H live-verifies (board convention).
- Full `AGENTS.md` post-task smoke checklist, desktop **and** touch. The Quote CSV + PDF export item matters most.

## 6. How to test (Law L — starts with getting the new code on screen)

1. **Get the build on screen.**
   - **Live, after H pushes and Vercel deploys:** open `https://planner.brownboxkit.co.nz` and press
     **Ctrl+Shift+R** once, so the browser does not serve the old cached version.
   - **Locally:** in `C:\dev\kitchen-planner-v3` run `git pull`, then `npm ci --include=optional` (a plain
     `npm install` can omit jspdf's optional `canvg` and break the build), then `npm run dev`, and open the
     printed URL (normally `http://localhost:5173/`). The dev server reads the **live** Shopify catalogue.
2. **Ordinary export.** Place two Shopify cabinets, then click **⬇ Download Quote** (the `btn-export` button, which downloads the CSV).
   Open `kitchen-quote.csv` in Excel by double-clicking it. *Expect:* four columns —
   Product / Variant / Price / Image URL. Each cabinet row has a `https://cdn.shopify.com/…` link, and
   the Total row's link cell is blank. Prices are right-aligned numbers, and the total matches the
   on-screen quote.
3. **The `"` case (S, controlled — not possible from a Windows file name).** In the local dev build, give
   one product a title containing `"` without touching Shopify: in DevTools → Network, use
   **Override content** on the Storefront GraphQL response (or the local-stub method used for 1.19's
   "controlled Storefront response"), changing one placeable product's `title` to `24" Test Cabinet`.
   Reload, place it, and click **⬇ Download Quote**. *Expect:* in Excel and Sheets the name reads `24" Test Cabinet` in one
   cell, and the Variant / Price / Image cells are not shifted. Remove the override afterwards.
4. **Formula cases (H can run these live).** Take any `.glb` file. You can download one from a product's
   model URL, or use any you have. Make two copies named `=1+1 test.glb` and `@SUM(1) test.glb`. In the
   planner open the **☰** menu → **📦 Import GLB**, upload each one, and place both. Click **⬇ Download Quote**. *Expect,* in **Excel**: the
   cells show `'=1+1 test` and `'@SUM(1) test` as text, **not** `2` or an error. Imported models have a
   blank Image URL cell.
5. **Google Sheets.** In Google Sheets choose **File → Import → Upload**, pick the same file, and choose
   **Insert new sheet**. *Expect:* the same four columns. The two names show as text (with or without a
   visible apostrophe), never a calculated value. The `↳` marker is readable if any component line exists.
6. **Service line.** Add **INSTALL QUOTE REQUEST** and click **⬇ Download Quote**. *Expect:* its row has the product's image
   link, or a blank cell if the Shopify product has no image. Nothing breaks either way.
7. **PDF unchanged.** Export the PDF for the same design. *Expect:* it looks exactly as before and the
   totals agree with the CSV.
8. **Touch.** On an iPad or iPhone, or in a 390px window with touch emulation, tap **⬇ Download Quote** once.
   *Expect:* the file downloads and opens in Numbers/Sheets with four columns.
9. Run the full `AGENTS.md` post-task smoke checklist, desktop **and** touch.
