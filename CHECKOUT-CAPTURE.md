# Checkout capture for Trade intake

Trade reads Shopify `orders/paid` webhooks. Every order must carry **shipping name**, **email**,
**mobile phone**, and a **validated shipping address** (no free-text province typos like `AUK`).

## Surfaces changed

| Surface | What | Owner |
|---|---|---|
| **Planner Send to Cart** (`main.js`) | Stamps cart attributes `project_code` + `display_po` (6-digit) on `cartCreate` | Deploy planner after merge |
| **Shopify Admin → Settings → Checkout** | Customer contact + phone required + address autocomplete/validation | Owner (one-time) |

Planner code does **not** control checkout form fields — those are Shopify checkout settings (and
native NZ address autocomplete). See steps below.

## Owner: Shopify checkout settings (one-time)

From [Shopify checkout form options](https://help.shopify.com/en/manual/checkout-settings/checkout-form-options)
and [address collection preferences](https://help.shopify.com/en/manual/checkout-settings/address-collection-preferences):

1. **Settings → Checkout** (or **Checkout and accounts**).
2. **Customer contact method** → **Email** (email is always collected on shipped orders).
3. **Customer information → Shipping address phone number** → **Required**.
   - Applies only when checkout includes a **shipping address** step (physical products).
   - Apple Pay may omit phone even when required — document if that blocks field trials.
4. **Address collection** — leave **Shopify address autocomplete** and **address validation**
   enabled. New Zealand is in the supported country list; customers should pick from suggestions
   rather than typing province free-text.
5. Confirm cabinet SKUs are **Physical product** (requires shipping). Digital-only products skip
   the shipping step and the phone requirement does not apply.

## Planner cart attributes (code)

On **Send to Cart**, the planner stamps:

- `project_code` — stable join key (`BBK-XXXXXX` for saved projects; ephemeral for unsaved plans)
- `display_po` — random 6-digit string for Trade job title before Carton Cloud API

These map to order `note_attributes` on `orders/paid`. Trade intake reads them in `shopifyIntake.ts`.

## Verify (L2 — owner test order)

1. Deploy planner with this change.
2. Apply Shopify checkout settings above.
3. In planner: place a cabinet, **Send to Cart**, complete checkout with:
   - Shipping name: **Mr Test**
   - Email: your test inbox
   - Mobile: e.g. `+64 21 123 4567`
   - Address: pick from autocomplete (e.g. **20 Pitt Street, Auckland 1010**)
4. In Shopify Admin → **Orders** → open the test order → confirm:
   - `shipping_address.name` = `Mr Test` (not Google account name)
   - `shipping_address.phone` or order `phone` populated
   - `email` populated
   - `shipping_address.province` = `Auckland` with `province_code` = `AUK` — this is the
     expected normalized PASS state (`AUK` is Shopify's ISO 3166-2 region code for Auckland;
     A ruling 19 Aug 2026). FAIL only if free-text `AUK` was typed as the province **name**.
   - **Additional details** / note attributes: `project_code`, `display_po`
5. Export webhook payload or screenshot for Trade PM. Trade job should show name, email, phone,
   address, PO after intake (requires S-INV promote + `display_po` migration on shared DB).

**Done when:** test order JSON shows shipping name, phone, email, clean address, and both cart
attributes — verified in Shopify Admin or `orders/paid` payload, not just code review.
