# RELAY.md — Shared relay: A (Fable auditor) ⇄ O (PM Opus) ⇄ S (Composer)

> **What this file is.** The one **git-tracked** channel where the three agent roles hand work
> and findings to each other. Before this file existed, O→S handoffs lived in brief files and
> A→O findings lived only in chat — so an A finding died with the chat window (Law S: a rule in
> a file nobody loads is decoration). This file makes those handoffs durable and auditable.
>
> **What this file is NOT.** Not a second source of truth. **[TASKS.md](TASKS.md) remains the
> single source of truth** for status and sequencing (Law J). This relay carries *messages and
> evidence*; the board carries *status*. If the two ever disagree, **TASKS.md wins** and the
> relay entry is the defect — fix it by amendment (Law N/O).
>
> **Authority is unchanged** ([ROLES.md](ROLES.md)): command flows `H → O → S`; assurance flows
> `A → H`. A writing here does **not** command O — an entry from A is a finding for H to action.
> H remains the only role that approves gates.

## How to use it

- **Append only.** Add a new entry at the top of the log; never rewrite or delete a past entry.
  If an entry was wrong, add a correction entry that supersedes it and say so (Law R: lead with
  the correction).
- **One entry per handoff.** Entry header: `### <date> · <FROM> → <TO> · <subject>`.
- **Every entry states evidence.** "Built", "pushed", and "verified" are three different claims
  (Law A). Say which one you are making, and name the artifact (commit SHA, file, screenshot).
- **Cite the board item.** Every entry names the [TASKS.md](TASKS.md) item it maps to. If it maps
  to none, that is the finding — say so and stop (Law B).
- **Never fabricate.** If a doc, file, order, or verification does not exist, write that it does
  not exist (Law R).

### Entry template

```
### YYYY-MM-DD · FROM → TO · subject
**Board item:** TASKS.md <id>
**Claim level:** built | pushed | verified-local | verified-live
**What happened:** ...
**Evidence:** commit / file / artifact
**Open questions / asks:** ...
**Blocked on:** role + exactly what is needed
```

---

## Standing register — who owes what

| # | Item | Board | Owner of next action | Blocking reason |
|---|---|---|---|---|
| 1 | C3 Send-to-Cart stuck after browser Back | Bug brief | H — live verify (see R5) | Code in `2a9b9fd`, verified-local with a control run. Status convention: ✅ only after live |
| 2 | 1.18 Component SKUs (S6) | `1.18` | H — see R4, then live verify | Code in `ade39f8`, dormant. Needs a real metafield, storefront-exposed, to prove the live cart |
| 3 | 1.15c Owner Shopify data pass | `1.15c` | **H only** — R1 | Requires Shopify Admin login. No agent has, or should have, admin credentials |
| 4 | Track 3 — apply Supabase SQL | Track 3 | **H only** — R2 | Requires Supabase SQL editor (service-role). Never client-side |
| 5 | Track 3 — confirm Trade `project_code` key | Track 3 | **H → Trade** — R3 | Cross-system contract; Law Q forbids unilateral change |
| 6 | Track 3 — checkout evidence #1034/#1035 | Track 3 | **H only** — R3 | Requires Shopify order JSON export. 🔴 U1 stays open until #1034 shows phone populated |
| 7 | A rulings requested this cycle | — | **A** | Four open questions: BOM-vs-add-on intent, one-branch sequencing, agent-observed audit counts, unresolved-component cart behaviour |
| 8 | C6 CSV injection / quoting hardening | new `C6` | O — brief when scheduled | Pre-existing, surfaced by the 1.18 review. Not a regression; deliberately not fixed in 1.18 |

---

# Log (newest first)

### 2026-08-19 · O → A · ⚠ Live catalogue drift observed — does NOT lift the 1.15c hold

**Board item:** TASKS.md `1.15c`
**Claim level:** observed (agent-side) — **explicitly NOT the H verification the hold requires**

**What happened.** While testing 1.18 against the **live** Shopify catalogue, S's harness ran
`?catalogaudit=1` and incidentally captured the four held counts. They do not match the last
H-verified reading:

| Count | H-verified 29 Jul 2026 | O-side observation 19 Aug 2026 |
|---|---|---|
| Total products | 53 | 53 |
| Drafts | **40** | **38** |
| Missing `glb_url` | 3 | 3 |
| Unparseable dims | 0 | 0 |
| Missing `category` | 0 | 0 |

**Why O is not touching the board with this.** The A hold (19 Aug) says these counts "do not move
until **H** re-runs `?catalogaudit=1` on live and reports dated numbers." An agent-side reading is
not an H reading, so O has left `1.15c` exactly as it was. This entry is a **flag for A**, not a
status change. Two products appear to have been published since 29 Jul, which if real means H has
already made a start on sub-task A.

Note also that this reading was taken through a test harness that intercepted the Storefront
response in order to inject a `component_skus` value. The four counts above come from the
unmodified fields, but O will not stake a board change on a number captured through an
instrumented request. **H should re-run it clean** per runbook R1.

**Asks of A:** decide whether an agent-observed count is worth recording as provisional, or whether
the hold means it should not appear on the board in any form. O's recommendation: keep it here in
the relay only, exactly as now, until H reports a clean dated reading.

---

### 2026-08-19 · O → A · Task 1.18 Component SKUs: code complete, dormant until H sets a metafield

**Board item:** TASKS.md `1.18` (brief S6)
**Claim level:** **verified-local** (against the live catalogue, via a local build) — NOT verified-live
**Commit:** `ade39f8`

**What happened.** S built S6 off the re-issued brief. `planner.component_skus` is read from the
Storefront query and expands a placed item into **additional** cart lines on top of its primary
variant, with the breakdown flowing into the quote panel, CSV and PDF.

**O rulings made during this task** (the S6 brief left these implicit — recorded here so A can
challenge them rather than discover them in the diff):

1. **Components are additional, not a substitution.** Follows the approved S6 architecture note.
   ⚠ **A/H should sanity-check this against commercial intent.** Brown Box Kit sells flat-pack, so
   `component_skus` *could* have been meant as a bill of materials, where the parent price already
   covers the parts and adding component lines would **overcharge**. O followed the brief as
   written (Law N — deviation only by amendment), but if H's intent is BOM, this needs an amendment
   to S6 **before H populates any metafield**. It is safe to sit in `main` meanwhile because it is
   inert with no data (see below).
2. **Component prices are included in the quote total.** Because the cart charges those lines, a
   quote that omitted them would under-quote the customer. All four paths (on-screen, CSV, PDF,
   cart) were verified to reconcile.
3. **Unresolvable variantIds are never given an invented name or price** — unknown label, $0.00,
   warn once, but still sent to the cart, since the variant may be real yet outside the fetched
   page set.
4. **An explicit `qty: 0` is skipped, not floored to 1.** Raised by the reviewer; O ruled the
   skip, because flooring an explicit zero up to one silently overcharges now that component
   prices reach the total, and inventing a quantity is the same fabrication ruling 3 forbids.

**Evidence.**
- **No-op proof** (the acceptance bar, since no product carries the metafield): CSV bytes, PDF
  extracted text, on-screen total, cart `lines`, and quote-panel text are all identical to the
  pre-change baseline at commit `2a9b9fd`. The four held audit counts are unchanged and every
  pre-existing audit column keeps its original position.
- **Feature proof** (metafield injected at runtime, never committed): parent placed ×2 → cart got
  the resolvable component at qty 4 and the unresolved one at qty 2; totals reconciled three ways
  at $881.79; `qty: 0` and `qty: -2` entries were skipped with named warnings.
- Reviewer verdict: **fix-then-ship**. All blocking fixes applied and re-verified.
- `npm run build` passes, independently re-run by O.

**Two risks A and H must see.**
1. **Storefront visibility.** Setting the metafield in Shopify Admin is necessary but **not
   sufficient** — the definition must also be exposed to the Storefront API, or the query returns
   `null` and the feature stays silently off (the audit column will read `absent`). Added to
   runbook R4 below.
2. **One bad component id can kill the whole cart.** `cartCreate` returns `userErrors` for an
   unavailable or draft variant and the handler treats that as a hard failure, so a single
   unresolvable component would break Send-to-Cart entirely — on a catalogue where most products
   are Draft. O chose **early warning over silent dropping**: the audit tool now flags unresolved
   component variants explicitly, so H sees it before it reaches checkout. A: if you would rather
   the cart silently drop unresolvable components, that is an amendment to ruling 3 and O will
   take it.

**Deliberate deviation from the brief (declared).** The PDF indent marker is ASCII `> `, not `↳`:
jsPDF's built-in Helvetica is WinAnsi-encoded and cannot render U+21B3. The on-screen quote and the
CSV, both UTF-8, keep `↳`. The reviewer confirmed this is sound and that the CSV needed a UTF-8 BOM
to survive Excel on Windows — that fix is in.

**Blocked on:** H — set `planner.component_skus` on one test product (and expose it to the
Storefront API), then live-verify. Until then this is code-complete and dormant, not done.

---

### 2026-08-19 · O → A · Bug C3 fixed: Send-to-Cart no longer stuck after browser Back

**Board item:** TASKS.md 🔴 Bug brief `C3`
**Claim level:** **verified-local** (real Chrome bfcache restore, with a control) — NOT verified-live
**Commit:** `2a9b9fd`

**What happened.** The board's root-cause diagnosis was correct and complete: no `pageshow`
handler existed anywhere in `main.js`. The success path of the `btn-send-cart` handler deliberately
never re-enables the button, because the page is navigating to Shopify checkout — so a bfcache
restore handed back the DOM with the button disabled on "Adding to cart…", killing the shipped
revenue path until a hard reload.

Fix is one null-safe `pageshow` listener, 17 added lines, insertion-only.

**One design point worth A's eye.** The handler resets **unconditionally** rather than gating on
`event.persisted`. iOS Safari and some Android browsers restore the pre-navigation DOM without
setting `persisted`, so a `persisted`-gated reset would have left the bug unfixed on the very
platforms it was reported on. Resetting an already-idle button is idempotent, and on a cold load it
is a no-op because the values written are exactly the initial state authored in `index.html`. The
code carries a comment telling the next reader not to "optimise" it back into a `persisted` check.

**Evidence — the control run is the part that matters:**

```
with fix:    restored from bfcache: true | enabled: true  | label: "🛒 Send to Cart"   → PASS
without fix: restored from bfcache: true | enabled: false | label: "Adding to cart…"  → FAIL
```

`persisted === true` on restore proves it was a genuine bfcache restore and not a reload. Diff
confirmed as `main.js | 17 +` and nothing else. Reviewer verdict: **ship**.

**Residual, judged acceptable and not fixed here.** If a user presses Back while `cartCreate` is
still in flight and the page is somehow restored, a second `cartCreate` could fire. Outstanding
network requests generally make a page bfcache-ineligible, and `cartCreate` takes no payment, so
the worst case is a duplicate abandoned cart plus one extra analytics event — against a
pre-existing worst case of a permanently dead button. Airtight version is a module-scope
`cartRequestInFlight` flag; out of scope for this brief. **A: say if you want it briefed.**

**Blocked on:** H — live verification on planner.brownboxkit.co.nz. The test that matters is Send
to Cart → browser Back → button reads `🛒 Send to Cart` and is clickable, on desktop **and**
iPad/iPhone Safari.

---

### 2026-08-19 · O → A · Cycle open: C3 + 1.18 built; 1.15c + Track 3 remain owner-gated

**Board items:** Bug brief `C3`, `1.18`, `1.15c`, Track 3.

**Instruction received (from H):** carry out the four top open items; create this relay; delegate
to S; report to A here; commit current state.

**O's honest split of the four items — read this first.** Two of the four are buildable by an
agent; two are not, and no amount of delegation changes that:

| Item | Buildable by S? | Why |
|---|---|---|
| C3 bfcache reset | **Yes** | Pure frontend fix in `main.js`. Root cause already diagnosed on the board |
| 1.18 Component SKUs | **Yes (code)** | S6 brief already written. Live cart proof still needs H's metafield data |
| 1.15c Shopify data pass | **No** | Board marks it 👤 `[owner task, not an S brief]`. Needs Shopify Admin. Also under an **A hold (19 Aug)**: counts must not move until H re-runs `?catalogaudit=1` live and reports dated numbers |
| Track 3 | **No** | Needs Supabase SQL editor, a Trade-side confirmation, and a Shopify order export. Law Q: shared/cross-system resources are never changed unilaterally |

O did **not** mark items 3 or 4 as progressed. Claiming otherwise would be fabrication (Law R).
What O produced for them instead is an **owner runbook** (below) so H can execute them without
deciding anything technical cold (Law H).

**Sequencing decision (O, for A to audit).** C3 and 1.18 both touch the `btn-send-cart` region of
`main.js` (C3 adds a sibling `pageshow` listener; 1.18 edits `lineMap` aggregation inside the click
handler). Splitting them across two branches off `main` would have guaranteed a merge conflict in
the same function. O chose **one branch, one commit per task, reviewer run between them** — so each
task stays an independently revertable unit (Law D) and review still keeps pace with build (Law C).
A: if you judge this the wrong call, the remedy is two stacked PRs, and O will take the conflict.

**Line-anchor drift found (Law B).** The S6 brief in
[S-BRIEFS-ITEMS-0-5.md](S-BRIEFS-ITEMS-0-5.md) cites anchors that have since moved. Recorded so
the brief can be amended rather than silently ignored (Law N):

| Symbol | Brief says | Actually at |
|---|---|---|
| `PRODUCTS_QUERY` | 4579–4607 | 4613–4641 |
| `shopifyNodeToProduct` | 4611–4639 | 4686–4720 |
| `btn-send-cart` handler | 5478–5535 | 5685–5746 |
| `buildQuoteRows` | 5540–5566 | 5751–5793 |
| `buildQuotePDF` | 5579–5665 | 5806–5892 |
| CSV `btn-export` handler | 5667–5694 | 5895–5925 |
| `updateQuote` | 4792–4808 | (moved — re-locate by name) |

S was instructed to re-locate by function name, not line number.

**Evidence:** see the per-task entries appended below as each task completes.

**Asks of A:**
1. Rule on the one-branch sequencing decision above.
2. Confirm O is right to refuse to progress `1.15c` / Track 3 without H, rather than logging
   partial credit.
3. Note that the S6 brief needs a line-anchor amendment (Law N) — O has not edited that file.
4. **Minor doc-integrity note (Law S).** The board header points at
   `.cursor/plans/auto-design_go-live_sprint_ea6d98db.plan.md` as "current execution order", but
   `.cursor/*` is gitignored apart from `environment.json` and `agents/`, so that file is not in
   the repo and **no fresh agent session can read it**. It is not fabricated — it presumably exists
   on H's machine — but a governing pointer that agents cannot load is decoration. Suggest either
   un-ignoring `.cursor/plans/` or moving the execution order into a tracked file.

**Blocked on:** H for items 3–6 in the standing register.

---

## Owner runbook — the two items only H can do

> Law H: numbered steps, one action per step, and no technical decision left to H cold.
> O's recommendation is given as the default in each case.

### R1 · 1.15c — Shopify catalogue data pass  (unblocks nothing else; safe to do any time)

The A hold means **step 1 comes first and the board stays frozen until it is reported.**

1. Open `https://planner.brownboxkit.co.nz/?catalogaudit=1` on desktop Chrome.
2. Open DevTools (`F12`) → **Console** tab.
3. Find the group `🗂️ Catalogue audit (?catalogaudit=1)` and read the four count lines.
4. Report those four numbers **with today's date** to A. Expected shape, from the 29 Jul reading:
   total products / drafts / missing `glb_url` / unparseable dims / missing category.
   *Success looks like:* four numbers you can paste as text. Until this is reported, nobody may
   restate the 29 Jul counts as current.
5. Then, in Shopify Admin, work the remaining sub-tasks A/C/D/E from the board: publish the
   products still marked Draft, add `planner.glb_url` to the 3 products missing a model, replace
   the reused/stretched GLBs, and split any composite "set" models.
6. Re-run step 1 and confirm the counts moved in the direction you expect.

### R2 · Track 3 — apply the two SQL files  (this is Deploy 1 of the go-live sprint)

Both files are already authored in this repo and are additive and reversible. Neither has been
applied. **O cannot apply them** — that needs the Supabase SQL editor, which is owner-only, and
Law Q forbids an agent touching a shared schema alone.

1. Open Supabase → your project → **SQL Editor** → **New query**.
2. Open [supabase/project-code.sql](supabase/project-code.sql) in this repo, copy the whole file,
   paste it into the editor, and click **Run**.
   *Success looks like:* "Success. No rows returned" and no red error.
3. Open a second **New query**.
4. Open [supabase/planner-admin-roles.sql](supabase/planner-admin-roles.sql), copy the whole file,
   paste, and click **Run**.
   *Success looks like:* the same "Success" message. This adds `public.planner_is_admin()` and does
   **not** touch the shared `is_admin()`, `profiles`, or the role CHECK.
5. Reply here (or to A) with the two results. Then A can move Track 3 off "authored, not applied".

**Do not** disable RLS at any point, for any reason (AGENTS.md § Security).

### R3 · Track 3 — the two confirmations O cannot make

1. **Trade cart-attribute key.** Ask Trade to confirm the key their intake reads is exactly
   `project_code`, and to add `super_admin` to the shared `profiles.role` CHECK.
   O's note: the planner already stamps `project_code` and `display_po` (`main.js`, `btn-send-cart`
   handler) — so if Trade reads a different key, the planner side is the one that must change, and
   that is a cross-system amendment, not a quick patch.
2. **Checkout evidence for orders #1034 / #1035.** Export the order JSON (or screenshot the order
   page) per [CHECKOUT-CAPTURE.md](CHECKOUT-CAPTURE.md) § "Done when", and attach it. Per the
   19 Aug board note both orders are **EVIDENCE PENDING** — reported-PASS is not verified, and
   🔴 U1 stays open until the #1034 artifact shows the phone field populated.
3. **3PL delivery-SMS phone field** is still an open *question for Trade*, not a conclusion:
   which field does Carton Cloud read — `shipping_address.phone` or `billing_address.phone`?
   Do not let anyone close this by assumption.

### R4 · 1.18 — how to switch Component SKUs on (do NOT do this until A rules on BOM-vs-add-on)

**Read the ruling-1 warning in the 1.18 log entry first.** If `component_skus` was meant as a bill
of materials rather than add-ons, populating a metafield now would start **overcharging** customers.
Confirm the intent with A before step 1.

1. In Shopify Admin, go to **Settings → Custom data → Products** and add a metafield definition
   with namespace `planner`, key `component_skus`, type **JSON**.
2. On the same definition, tick the option that exposes it to the **Storefront API**.
   *This step is the one people miss.* Without it the query returns `null`, the planner sees
   nothing, and the feature is silently off with no error anywhere.
3. Pick ONE test product. Set its `planner.component_skus` to a single component, using a real
   variant GID:
   `[{"variantId": "gid://shopify/ProductVariant/1234567890", "qty": 2}]`
4. Open `https://planner.brownboxkit.co.nz/?catalogaudit=1` and check the new
   `component_skus_status` column for that product.
   *Success looks like:* `OK` and a count of `1`. If it reads `absent`, step 2 was missed. If it
   reads `OK (1 unresolved)`, the variant GID is wrong or that product is Draft — **fix it before
   sending anything to the cart**, because Shopify rejects the whole cart if it refuses one line.
5. Place that product twice in the planner, open the quote, and confirm the component line appears
   and the total includes it.
6. Download the CSV and the PDF and confirm all three totals agree.
7. Click Send to Cart and confirm the Shopify cart shows the parent at qty 2 **and** the component
   at qty 4.

### R5 · C3 — live verification (2 minutes, desktop then iPad)

1. Open `https://planner.brownboxkit.co.nz` **after the next Vercel deploy of `main`**.
2. Place any cabinet, then click `🛒 Send to Cart` and let it reach the Shopify checkout.
3. Press the browser **Back** button.
   *Success looks like:* the button is green and reads `🛒 Send to Cart`. Before this fix it stayed
   grey on "Adding to cart…" until a hard reload.
4. Click `🛒 Send to Cart` again — it must actually reach checkout, proving the button is live and
   not merely relabelled.
5. Repeat steps 2–4 on **iPad and iPhone Safari**. This is the important one: those browsers restore
   the page without always setting `event.persisted`, which is exactly why the fix does not gate on
   it.
