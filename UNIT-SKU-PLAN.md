# UNIT-SKU-PLAN.md — Complete-Unit SKU System (spec-first, build NOT scheduled)

> **Status: spec only.** Nothing in this file is scheduled for build. Phases U2/U3 are
> gated (see § Phases) and O writes bounded S-briefs only when a phase's entry gate is
> met and H approves. Board home: `TASKS.md` Track 6.
>
> **Author:** `O-opus-19aug26` — O, PM (Opus cloud agent). Spec written 19 Aug 2026 from
> H's product clarification (same date) and O's competitor research.

## 1. The business model this serves (H's clarification, 19 Aug 2026)

1. **One cabinet SKU is already a complete cabinet** — carcase, legs, hinges, door
   panels. That is the product's bill of materials; its price covers all of it.
2. **Parts are also sold separately** (hinges, panels, legs) as extras/replacements.
   These are **store-only** SKUs — they must never appear in the planner catalogue.
3. **The planner's differentiator is the complete unit**: when a customer taps a
   cabinet in the planner, it arrives with benchtop and sink / oven / hob already
   attached. Each companion (benchtop, sink, oven, hob) is its **own SKU** and its own
   cart line — the customer sees one unit, the order itemises everything.
4. Goal: **simpler, faster and better than IKEA** — not a copy. Design experience as
   simple as possible; "lightning fast design".
5. The SKU system must not be limited by how the planner works today. Planner
   engineering improves to fit the model, not the other way round.

### The one-sentence model

> A planner item is a **Unit** = one anchor cabinet SKU + named **slots**
> (benchtop, sink, oven, hob…) each filled by a companion SKU; every SKU is a
> separate cart line, and the customer only ever handled one object.

## 2. Competitor findings and why our model beats them

| System | How it works | Weakness we exploit |
|---|---|---|
| **IKEA METOD/SEKTION** | Frame + fronts + hinges + legs are all separate SKUs the *customer* must combine; planner produces 20–40-line orders; design sessions are long and error-prone | We pre-assemble the decision: one tap = one complete unit. Customer never assembles a BOM |
| **Kaboodle** (Bunnings) | Flat-pack "base + door" pairing, planner hands off to in-store consult; benchtops quoted separately, not live | Our benchtop/appliance is in the unit, priced live, straight to checkout — no consult loop |
| **Planner 5D** | Generic room planner; beautiful, but no live retail catalogue or cart — output is a picture, not an order | Ours ends in a Shopify cart with real SKUs, quote PDF, and (Track 3) a Trade job |

Our structural advantage: the catalogue is metafield-driven (`planner.*`), so the
unit definition lives **in Shopify next to the product**, maintained by H without
code changes — none of the three competitors let the merchant do that.

## 3. The metafield contract

- **v1 (shipped in 1.18, commit `ade39f8`, dormant):** `planner.component_skus` =
  flat JSON array `[{"variantId": "gid://…", "qty": 2}]`. Components are **add-on
  lines priced on top of the parent** — **CONFIRMED by A+H, 19 Aug 2026**: the intent
  is ADD-ON, not a bill of materials. O ruling 1 stands as built and needs no
  amendment; see RELAY.md § ruling entry (19 Aug). The BOM risk that gated U0 is
  therefore closed.
- **v2 (phase U2, not built):** same metafield, entries gain an optional
  `"slot"` name (`benchtop`, `sink`, `oven`, `hob`, …) and the parser stays
  backwards-compatible with flat v1 lists. Slots enable per-item swap/remove in the
  planner; slotless entries behave exactly as v1.
- **Store-only parts** (rule 2 above) must be excluded from the planner catalogue.
  ⚠ **CORRECTION (A verified 19 Aug 2026): the exclusion mechanism did not exist.**
  An earlier version of this bullet claimed parts were "excluded from the planner
  catalogue via `planner.category` … no code change needed". That was wrong.
  `renderProductPanel` has **no category filter of any kind** — it groups every
  product in `products` by `productType` and renders all of them, so the only thing
  keeping any product out of the panel today is Shopify's `(Draft)` title filter in
  `loadShopifyProducts`. A part published to the Storefront with any (or no)
  `planner.category` would appear as a placeable item. Carrying no `planner.*`
  metafields does not hide it either — the fallbacks (`600×720×580`, placeholder box)
  exist precisely to render such a product anyway.
  **The mechanism is being built now** — board item `1.19` (store-only catalogue
  filter): the panel filters on an agreed `planner.category` value while the product
  stays in `products`, so a store-only part still resolves with its real name and
  price when referenced in `component_skus`. Until `1.19` is on `main` and
  H-live-verified, U0 must not publish parts to the Storefront.

## 4. Phases and entry gates

### U0 — Owner data pass (H; prerequisite for everything)
Upload companion SKUs (benchtops, sinks, ovens, hobs) to Shopify with
`planner.category`; keep parts store-only; fill `component_skus` on the anchor
cabinets per runbook R4 in `RELAY.md`.
**Gate to start — add-on vs BOM: SATISFIED 19 Aug 2026.** A+H confirmed the intent is
**ADD-ON** (RELAY.md 1.18 ruling 1 stands as built), so the overcharge risk that held
this phase is closed.
**Two gates remain, both code on `main`:** (i) board item `1.19` store-only catalogue
filter, live-verified — without it a published part appears as a placeable cabinet
(see §3); (ii) board item `C8`, the 1.18 quantity-edge and audit resolved-set fixes —
without them a bad `qty` silently invents a quantity and the audit can report `OK` for
a component that will not resolve at runtime.
**Done when:** at least one real complete unit resolves clean in `?catalogaudit=1`,
**and** the parts published alongside it are confirmed absent from the catalogue panel.

### U1 — Land what is already built (in flight)
A audits the C3 + 1.18 branch, merge to `main`, H live-verifies runbooks R4/R5.
**Done when:** board items C3 and 1.18 go ✅ per the status convention (live-verified).

### U2 — Slotted units in the planner (NOT scheduled)
Slot-aware parser (v2), unit card UI (slot chips on selection, swap sheet from
same-category catalogue, remove), `scene_json` v5 with per-item slot overrides +
v1–v4 migration, swap/remove wired into undo/redo, audit-tool slot validation.
**Entry gate — all three:** (i) U0 done, (ii) U1 done (1.18 live-verified),
(iii) **the Direction 1/2 ruling is made** (board item F8) so the unit UI is designed
once for the direction that will carry it.

### U3 — Kitchen intelligence (NOT scheduled; folds into Direction 1 work)
Continuous benchtop run detection + run-length pricing with cutout flags; per-slot
GLB composition so swaps change visuals (existing `disposeModel()` pattern);
auto-design solver places complete Units instead of bare cabinets.
**Entry gate:** U2 live-verified AND auto-design (Track 2) is live.

## 5. Sequencing relative to the rest of the board

This system deliberately queues **behind** work already in flight or blocking:
PR audit/merge for C3+1.18 · 1.15c owner data pass (A hold) · Track 3 owner items ·
auto-design go-live (Track 2) · item-10 smoke remainder. It also **waits on the
Direction 1/2 ruling (F8)**, because Direction 1 (simple preset-wall kitchen planner)
is exactly where complete units shine, and the unit UI should be built once, knowing
that split.

## 6. Constraints carried over from 1.18 (binding on U2/U3 briefs)

### Data rule — NEVER list a cabinet's own internal parts in `component_skus`

**Binding data rule (A+H, 19 Aug 2026), the direct consequence of the ADD-ON ruling.**
`component_skus` entries are **charged on top of** the anchor cabinet's own price. A
cabinet SKU is already a complete cabinet — carcase, legs, hinges, door panels, and its
price covers all of it (§1 rule 1). So listing any of those parts in that cabinet's
`component_skus` **double-charges the customer for parts they have already bought**, on
every surface at once: the on-screen quote, the CSV, the PDF, and the real Shopify cart.
Nothing in the code can detect this — a hinge variant is a perfectly valid variant id,
so the planner will resolve it, price it, and add it. **The only defence is the data.**

- ✅ **Belongs in `component_skus`:** companion SKUs that are genuinely extra products
  the customer would otherwise have to buy separately — benchtop, sink, oven, hob, tap.
- ❌ **Never belongs:** anything already inside the anchor cabinet's own price — hinges,
  legs, door/drawer fronts, carcase panels, fixings, handles supplied with the unit.
- Those parts are **store-only** SKUs (§1 rule 2, §3): sold on the storefront as spares
  and replacements, kept out of the planner catalogue by board item `1.19`, and never
  referenced from an anchor cabinet's `component_skus`.
- Rule of thumb for H: *"if the customer would receive it anyway by buying this cabinet
  alone, it must not be listed."*

### Carried-over engineering constraints

- Unresolvable variantIds are never given an invented name or price (unknown, $0.00,
  flagged in the audit tool) — O ruling 3, standing.
- One draft/unavailable component variant fails the whole `cartCreate` — the audit
  tool must catch it before checkout (1.18 risk 2).
- The metafield definition must be exposed to the **Storefront API** or the feature
  is silently off (1.18 risk 1; runbook R4 step 2).
- All quote surfaces (on-screen, CSV, PDF, cart) must reconcile to the same total.
- House rules apply: additive changes, `pushHistory` for every mutating action,
  `scene_json` version bump + migration, touch and mouse parity, dispose pattern.
