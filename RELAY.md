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
| 1 | C3 Send-to-Cart stuck after browser Back | Bug brief | H — live verify | Code shipped; needs live-site verification (status convention: ✅ only after live) |
| 2 | 1.18 Component SKUs (S6) | `1.18` | H — set `planner.component_skus` on a test product, then live verify | Code path needs real metafield data to prove end-to-end in the live cart |
| 3 | 1.15c Owner Shopify data pass | `1.15c` | **H only** | Requires Shopify Admin login. No agent has, or should have, admin credentials |
| 4 | Track 3 — apply Supabase SQL | Track 3 | **H only** | Requires Supabase SQL editor (service-role). Never client-side |
| 5 | Track 3 — confirm Trade `project_code` key | Track 3 | **H → Trade** | Cross-system contract; Law Q forbids unilateral change |
| 6 | Track 3 — checkout evidence #1034/#1035 | Track 3 | **H only** | Requires Shopify order JSON export |

---

# Log (newest first)

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
