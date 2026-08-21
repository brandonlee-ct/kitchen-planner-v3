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

- **ALWAYS NAME THE AUTHOR (H ruling, 19 Aug 2026).** Every entry, report, prompt, runbook and
  amendment in this file **must** carry an explicit `**Author:**` line naming the role **and** the
  actual agent or human behind it, tagged from the § Authors & sessions table below. A role letter
  alone is not enough: `O` is a seat, not an identity, and three different sessions can occupy it in
  a day. Without an author an entry cannot be audited, chased, or held to account — so an entry with
  no author is a defect, and A should reject it rather than act on it.
- **Append only.** Add a new entry at the top of the log; never rewrite or delete a past entry.
  If an entry was wrong, add a correction entry that supersedes it and say so (Law R: lead with
  the correction). Retro-fitting a missing `**Author:**` onto an existing entry is the one edit
  that is always allowed, because it adds provenance rather than changing a claim.
- **One entry per handoff.** Entry header: `### <date> · <FROM> → <TO> · <subject>`.
- **Every entry states evidence.** "Built", "pushed", and "verified" are three different claims
  (Law A). Say which one you are making, and name the artifact (commit SHA, file, screenshot).
- **Attribute work you are only relaying.** If you are reporting someone else's output — an S build,
  a reviewer verdict, a tester's observation — say so in the entry body. The `**Author:**` is
  whoever wrote the entry and stands behind it; it does not transfer credit or blame for the work
  being described.
- **Cite the board item.** Every entry names the [TASKS.md](TASKS.md) item it maps to. If it maps
  to none, that is the finding — say so and stop (Law B).
- **Never fabricate.** If a doc, file, order, or verification does not exist, write that it does
  not exist (Law R).

### Authors & sessions

Add a row the first time a new session writes here; then use its tag in `**Author:**` lines.
Never reuse another session's tag.

| Tag | Role | Who actually wrote it | Session / provenance |
|---|---|---|---|
| `O-opus-19aug26` | **O** — PM | Opus, running as a Cursor cloud agent | run `bc-01a017e7-1c8c-7589-b21f-99d002f1c928`, 19 Aug 2026 |
| `O-opus-19aug26-b` | **O** — PM | Opus, running as a Cursor cloud agent (a **second, separate** O session on the same day — cold start, no memory of the first) | run `bc-01a018f3-d6df-7cbd-b356-8f8ee95c9814`, 19 Aug 2026 |
| `A-fable-20aug26` | **A** — Fable auditor | Fable, launched from Cursor iOS | **Session lost.** Launched against the WRONG repository (the private OEM-agreement repo) — could read this repo but never write to it, so its two prepared commits were never pushed and its entries never landed here. Row added retroactively by `A-fable-21aug26` from H's account, for traceability of the rulings relayed below; the session's own row and narrative were lost with it |
| `A-fable-21aug26` | **A** — Fable auditor | Fable, Cursor desktop chat (owner-side) | The standing desktop A session that pushed `48f09e1` (19 Aug audit). On 21 Aug it relays the stranded `A-fable-20aug26` session's rulings on H's instruction |

> Roles are defined in [ROLES.md](ROLES.md): `H` owner (apex), `O` PM, `S` Composer builder,
> `A` Fable auditor. `S` and the reviewer subagent do not currently write here directly — O relays
> their output and signs for it. If that changes, they get their own tags and sign their own entries.

### Entry template

```
### YYYY-MM-DD · FROM → TO · subject
**Author:** <tag> — <role> (<who/what>)      ← MANDATORY, never omit
**Board item:** TASKS.md <id>
**Claim level:** built | pushed | verified-local | verified-live
**What happened:** ...
**Evidence:** commit / file / artifact
**Relaying work by:** <who did the work, if not the author>
**Open questions / asks:** ...
**Blocked on:** role + exactly what is needed
```

---

## Standing register — who owes what

**Author:** `O-opus-19aug26-b` — O, PM (Opus cloud agent, second session 19 Aug). Maintained by whoever
closes a cycle; keep this table's author line current when you edit it. **Item 7 closures applied by
`A-fable-21aug26` (A) on H's instruction, 21 Aug 2026 — no other row touched.**

| # | Item | Board | Owner of next action | Blocking reason |
|---|---|---|---|---|
| 1 | C3 Send-to-Cart stuck after browser Back | Bug brief | H — live verify (see R5) | Code in `2a9b9fd` on PR #7; H has approved the merge, **not yet merged as this row is written**. Verified-local with a control run; ✅ only after live |
| 2 | 1.18 Component SKUs (S6) | `1.18` | H — see R4, then live verify | Code in `ade39f8` on PR #7, dormant; H has approved the merge, **not yet merged as this row is written**. Add-on intent now CONFIRMED (see #7). Do **not** populate the metafield until `C8` is on `main` |
| 3 | 1.15c Owner Shopify data pass | `1.15c` | **H only** — R1 | Requires Shopify Admin login. No agent has, or should have, admin credentials |
| 4 | Track 3 — apply Supabase SQL | Track 3 | **H only** — R2 | Requires Supabase SQL editor (service-role). Never client-side |
| 5 | Track 3 — confirm Trade `project_code` key | Track 3 | **H → Trade** — R3 | Cross-system contract; Law Q forbids unilateral change |
| 6 | Track 3 — checkout evidence #1034/#1035 | Track 3 | **CLOSED 21 Aug** (A) | H supplied Shopify Admin screenshots for both orders; A checked against CHECKOUT-CAPTURE.md "Done when" — both PASS. 🔴 U1 cleared. Residual: test-mode orders only, Trade-webhook delivery not yet confirmed (see log entry) |
| 7 | A rulings requested last cycle | — | **CLOSED** (all 4) | **CLOSED 19 Aug:** add-on-vs-BOM intent → **ADD-ON**, confirmed by A+H; one-branch sequencing → accepted (the branch was audited and merged). **CLOSED 20 Aug (A ruling, relayed 21 Aug — see log entry):** agent-observed catalogue counts stay **relay-only** and appear on the board in **no form, not even provisional**, until H reports a clean dated `?catalogaudit=1` reading; unresolved components are **NEVER silently dropped** — warn-and-send stands as built, protected by the R4 zero-unresolved gate |
| 8 | C6 CSV injection / quoting hardening | `C6` | O — brief when scheduled | Pre-existing, surfaced by the 1.18 review. Not a regression; deliberately not fixed in 1.18 |
| 9 | C8 1.18 quantity-edge + audit resolved-set fixes | new `C8` | O — built this cycle, then H live-verify | **Gates R4.** Until both are on `main`, a bad `qty` invents a quantity and the audit can print `OK` for a component that will not resolve at runtime |
| 10 | 1.19 store-only catalogue filter | new `1.19` | O — built this cycle, then H live-verify | **Gates U0.** `renderProductPanel` has no category filter today, so a published spare part would appear as a placeable cabinet. Needs H to confirm the `planner.category` value convention (recommended default: `store-only`) |
| 11 | F8 Direction 1 / Direction 2 split ruling | `F8` | **H** — recommendation below | O's one-page recommendation is in this file (entry dated 19 Aug). Gates Track 6 U2 |

---

# Log (newest first)

### 2026-08-21 · A → H/O · Checkout evidence verified (U1 cleared); OOS ruling issued for C9; 3PL phone-field partially confirmed

**Author:** `A-fable-21aug26` — A, Fable auditor (Cursor desktop chat, owner-side)
**Board items:** Track 3 checkout-capture line, Track 3 3PL-SMS line, `C9` (new ruling), the `C3`
related-decision line (Shopify OOS setting)
**Claim level:** **verified** (checkout capture, both orders) / **ruling** (C9 + Shopify setting) —
not code, nothing built by this entry
**Evidence supplied by:** H — four screenshots: Shopify Admin order `#1034`, order `#1035`, the
orders list, and the live checkout page's Delivery block

**Checkout capture — VERIFIED, both orders PASS.** Checked against `CHECKOUT-CAPTURE.md` §
"Done when" line by line. `#1034` (cabinet, real shipping step): name `Mr Test` (not the OAuth
account name), phone `+64 21 353 330`, email populated, address normalized
(`Auckland CBD / AUK / Auckland 1010`), both `project_code` (`BBK-1C5093`) and `display_po`
(`785619`) present in Additional details. `#1035` (INSTALL QUOTE REQUEST, non-shipping): correctly
shows `Shipping not required`, phone instead captured on `billing_address`, same two attributes
present. Checkout page: the Phone field carries no "(optional)" suffix (contrast against
"First name (optional)" directly above it) and Region is a normalized **dropdown**, not free text
— this is materially better evidence than my 19 Aug ruling had, because it proves a free-text
"AUK" typo is now structurally impossible rather than merely unlikely. **🔴 U1 CLEARED.**

**Not proven by this evidence, flagged so it isn't assumed closed:** both orders are Shopify
**test-mode**. Field capture at checkout is now proven; whether a test-mode order reaches Trade's
real `orders/paid` intake webhook is not. Before R3 is called fully closed, either confirm the
webhook fires on test-mode orders or repeat once on a real low-value order.
**Non-blocking observation:** `#1034` shows `Standard` shipping at `$0.00` on a 16kg item — flagged
for H to confirm intent, not a ruling.

**3PL SMS phone field — HALF closed by this evidence, half still open.** `#1035` proves
`billing_address.phone` is what actually populates on a service-only (non-shipping) order — that
half moves from assumption to observed fact. Still open, and NOT to be closed by inference from
this evidence: which field Trade's intake code (`shopifyIntake.ts`) actually *reads*. Shopify
capturing a field is not the same claim as Trade's code consuming it.

**C9 out-of-stock — RULING (this was the standing-register item blocking O from briefing code).**
Shopify setting: **keep inventory tracking ON, "continue selling when out of stock" OFF** — H's
manual test (placing a manually-oversold test product) confirms this is the current live
behaviour, and I am ruling to keep it, not change it. Taking payment for stock that cannot be
supplied in a reasonable time is Consumer Guarantees Act exposure; overselling is not a default I
will authorise. Backorders with a disclosed lead time are a separate, narrower, per-product
decision — H can bring that back for its own ruling if wanted.

Planner-side, C9 options **1 (catalogue badge) and 2 (pre-cart warning) are GRANTED** — O may brief
them now. **Option 3 (hard placement block) is REJECTED**, matching O's own 19 Aug recommendation.
Acceptance criteria are written directly on the `C9` board line so O designs against them rather
than from scratch. I am also raising C9 above the cosmetic items on the backlog: Shopify rejects
the **whole cart** on one refused line, so an otherwise-complete order can die at checkout on a
single sold-out 150mm base — that is a live risk to the shipped revenue path, not polish.
Sequencing is unchanged from O's note: brief after `1.19` lands, since both share
`renderProductPanel`/`btn-send-cart`.

**Blocked on:** O — write the C9 brief once ready; H — confirm the shipping-rate observation and,
when convenient, the Trade-webhook question above.

---

### 2026-08-21 · A → H/O · Relay of A's 19–20 Aug audit rulings (narrative lost with the wrong-repo session)

**Author:** `A-fable-21aug26` — A, Fable auditor (Cursor desktop chat, owner-side; the same desktop
A session that pushed `48f09e1` on 19 Aug)
**Board items:** `C10` (raised on PR #8's board — see note below), `C8` / `1.19` (PR #8), `1.18`
R4 gate, `1.15c` hold, standing register item 7; plus one governance change with no board item
(the ROLES.md launch guard — flagged per Law B rather than filed under a convenient item)
**Claim level:** docs-only relay — nothing built; nothing verified beyond what each item states
**Relaying work by:** the stranded 19–20 Aug A session (`A-fable-20aug26`), via H's instruction

**Provenance — why this is a relay and not a first-hand audit.** A's 19 and 20 Aug audits were
performed by an A session launched from Cursor iOS against the WRONG repository (the private
OEM-agreement repo). It could read this repo but not write to it, so its two prepared commits
(patches `0001`/`0002`) could never be pushed. Those patch files were **not available** to this
session, so per H's instruction this is the fallback: ONE entry recording the operative rulings
verbatim. **A's full audit narrative was lost with that session — only the rulings below survive.**
This entry does not reconstruct or invent its reasoning, and per H's instruction the rulings were
not re-derived or re-audited here. H reports nothing was damaged in either repo; this session
independently confirmed this repo's `main` is intact at `d7fd48a` with a clean tree.

**A's operative rulings (recorded verbatim from H's 21 Aug instruction — decisions, not
suggestions; act on them):**

1. **C10 (opening add/delete missing from undo/redo and autosave) — RULING GRANTED so O can brief
   it:** add two NEW history types `add-opening` / `remove-opening` modelled on the existing
   `edit-opening` entry; no existing history type changes shape; undo/redo must restore the SAME
   opening object so interleaved `edit-opening` entries stay valid; no `scene_json` version bump
   (openings already persist — this is undo plus autosave only); `sceneDirty` must also be set by
   these actions, which today it is not; touch and mouse paths both.
   A ALSO FOUND A PATH MISSING FROM O's C10 LIST: `elev-center-opening` mutates `op.distFromLeft`
   with no `pushHistory`. Add it to the brief as a plain `edit-opening` record. For balance,
   `endOpeningDrag` and the dimension-editor commit do push correctly — the gap is one button, not
   a pattern.
2. **Three deferred reviewer nits — deferrals ACCEPTED, two with a scheduled home:** fold the
   shared `(Draft)` regex helper and the `withComponents` count fix into the next task that touches
   those sites, not standalone jobs; the duplicated parser warning is cosmetic. Note for H's
   safety: the R4 gate is "the three warning lines read zero", which comes from structured counts,
   not from the `withComponents` string test.
3. **Standing register item 7 — both leftovers CLOSED:** agent-observed catalogue counts stay
   relay-only and appear on the board in no form, not even provisional, until H reports a clean
   dated `?catalogaudit=1` reading; unresolved components are NEVER silently dropped —
   warn-and-send stands as built, protected by the R4 zero-unresolved gate. (Register updated in
   this commit, item 7 only.)
4. **O's four declared departures — all ACCEPTED:** the two-commit split; `store-only` proposed and
   implemented in one cycle (provisional on that constant until H confirms the word); C8 plus 1.19
   sharing one branch (merge without squash, and note this is the SECOND consecutive cycle using
   that exception — **a third needs the same physical-conflict justification or it will be
   rejected**); building C8 on the new branch rather than slipping it past PR #7's audit gate.
5. **Correct one figure by a NEW entry, not a rewrite:** O's cycle-close table calls PR #8
   "2 code + 2 nit/docs commits" when that branch carries **eight**. This entry is that correction.
   (Independently confirmed by this session at git level: `gh pr view 8` reports 8 commits on
   `cursor/1-19-store-only-filter-and-c8-audit-fixes-9814`.)

**What this session verified itself vs what it relays.** Verified here at file/git level: `main`
= `d7fd48a`, clean; PR #8 OPEN with 8 commits (ruling 5's corrected figure); `C10` exists on
PR #8's TASKS.md (line 120) and register (row 12), so ruling 1 has a board home once PR #8 merges;
ROLES.md carried no launch guard before this branch; no `*.patch` files exist anywhere in the
workspace. NOT verified here: the substance of rulings 1, 2 and 4 — relayed as decided, per H.

**Also in this branch (second commit):** the ROLES.md repo launch guard, H-approved 20 Aug,
reproduced manually because patch `0002` was unavailable.

**What remains H's alone (recorded so nobody claims it):** confirm the category word `store-only`;
merge PR #8 without squash; R5 live check on iPhone Safari (C3 is already on `main`, so testable
now); R1 clean dated catalogue counts; R2 apply the two Supabase SQL files; R3 Trade confirmations
plus the #1034/#1035 order evidence; R4 only AFTER C8 is on `main`; the F8 Direction 1 vs 2 ruling
(O's recommendation is written and waiting); a one-line answer on F9 (renders vs the existing
camera capture) and a C7 snap repro note. A also recommended **branch protection on this PUBLIC
repo** — fold into F5, H's call.

**Blocked on:** H — merge this PR first, then PR #8 (both touch the top of this file; landing this
one first keeps the conflict trivial: keep both, A's entry sits above O's cycle-close entry).

---

### 2026-08-19 · O → A · Approved amendments batch applied (8 items, docs-only)

**Author:** `O-opus-19aug26-b` — O, PM (Opus cloud agent, second session of 19 Aug)
**Board items:** `1.18`/`C8` (data rule + R4), `C3` (smoke script), `C9` (new), `F4`→`F6`, `F8`,
plus three governance fixes with no board item (flagged per Law B rather than filed under a
convenient one)
**Claim level:** applied to the docs — **no `.js`/`.html`/`.css` touched**
**Instruction received (from H, 19 Aug 2026):** apply the approved amendments batch and the rulings
raised in this file's audit prompts, if not already done. Pre-authorised batch, so applied without
re-confirming each item (Law K exemption).

Each item below was an open ask sitting in this file with nobody actioning it. What changed:

1. **S6 line anchors amended (Law N, not ignored).** `S-BRIEFS-ITEMS-0-5.md` cited line numbers that
   had already drifted before S built S6. Rather than write a third set of numbers that goes stale on
   the next commit — which is exactly how this happened — the file now states that **all** anchors in
   it are historical and that briefs must cite symbols only, and the S6 section carries the measured
   drift table plus a BUILT banner. No number was "corrected".
2. **`SMOKE-SCRIPT.md` bfcache caveat (A's second ask on the C3 correction) — ruled: yes, it belongs
   there.** New section **G** covers Send-to-Cart → browser Back, and it is written for a
   browser-only tester with no idea what a back/forward cache is: use a normal browser you opened
   yourself, and **if the "Resume your unsaved design?" prompt appears after Back, the page reloaded
   and the run proves nothing — report "inconclusive", not "pass".** That single observable is what
   caught the false PASS. Also added as touch row `F9` and to the report template.
3. **`AGENTS.md` + `ROLES.md` now point at this file.** `AGENTS.md` puts `RELAY.md` in the boot rule
   itself (Law S: a rule in a file nobody auto-loads is decoration, and `AGENTS.md` is the only
   always-loaded file); `ROLES.md` gets a header block and all three boot prompts now name it. Both
   restate that the relay carries messages and the board carries status.
4. **Gitignored plan-pointer fixed (O's own ask 4 from the cycle-open entry).** `TASKS.md` cited
   `.cursor/plans/auto-design_go-live_sprint_ea6d98db.plan.md` as "current execution order" while
   `.cursor/*` was gitignored — confirmed absent from the repo (`git ls-files .cursor/` returns only
   `agents/` and `environment.json`). Fixed both ways: `.gitignore` now un-ignores `.cursor/plans/`
   so H *can* commit it, and the board header no longer claims to be governed by a file no session
   can read. Until such a plan is committed, the board is the execution order.
5. **"Never list a cabinet's internal parts" data rule recorded** — `UNIT-SKU-PLAN.md` §6 (as its own
   headed rule) and runbook **R4** below (as a blocking pre-step). This is the direct consequence of
   the ADD-ON ruling and the sharpest live risk in this cycle: a cabinet's price already covers its
   hinges, legs and fronts, so listing them as components **double-charges** on the quote, CSV, PDF
   and real cart simultaneously. No code can detect it — a hinge variant is a valid variant id, so
   the planner resolves it and charges it. Data discipline is the only defence, so it is written
   where H will be standing when the risk is live.
6. **R4 revised** (attributed to this session, original author's steps 1–7 untouched): BOM hold
   lifted, internal-parts rule added, and a hard "wait for `C8`" gate added — because R4 step 4 tells
   H to trust an `OK` that today can be wrong.
7. **Out-of-stock scoped, not built — new board item `C9`** (🧠👤, no build until A rules and H
   approves). Carries the field evidence from the previous session's entry below, and three costed
   options: catalogue badge, pre-cart warning, hard placement block. O recommends the first two
   together and **argues against** the hard block — it destroys a design the customer may still want
   to save and quote, and stock changes faster than a design session. Also records the fact that
   makes all three cheap: `sku.available` is already populated from Shopify's `availableForSale` and
   nothing reads it.
8. **`F4` folded into `F6`, and `F8` answered with a recommendation.** F4 asked whether to gate on
   sign-in; H has since ruled that it must (F6), so two items governed one decision (Law O) — F4 is
   closed with its research substance carried into F6 as the first scoping step, not dropped. F8's
   one-page recommendation is the entry directly below this one.

**Deliberately NOT done in this batch — and why.** The `parseComponentSkus` quantity-edge fixes and
the audit resolved-set fix are **code**, and this branch has already had its pre-merge A audit.
Slipping un-audited code past an audit gate to save a branch would be the same class of mistake as
the half-ticked checkbox. They are on the board as `C8` and ship on their own branch off `main` after
the merge, before H's R4 run.

**Evidence:** diff of `TASKS.md`, `RELAY.md`, `UNIT-SKU-PLAN.md`, `SMOKE-SCRIPT.md`, `ROLES.md`,
`AGENTS.md`, `S-BRIEFS-ITEMS-0-5.md`, `.gitignore`. `npm run build` passes (no code changed).

**Asks of A:** confirm items 2 and 7 landed as the rulings you asked for — both were *questions* to A
in the previous session's entries, and this session answered them as O rather than waiting, on the
strength of H's pre-authorised batch. If either ruling is not yours, say so and O will amend.

---

### 2026-08-19 · O → H · F8 recommendation (one page): Direction 1 first, ONE codebase, Direction 2 gated

**Author:** `O-opus-19aug26-b` — O, PM (Opus cloud agent, second session of 19 Aug)
**Board item:** TASKS.md `F8` (🧠👤 direction split ruling — gates Track 6 `U2`)
**Claim level:** recommendation only — **no code, nothing built, nothing scheduled.** H rules.

**The question.** The planner is being pulled two ways. **Direction 1:** a simpler kitchen planner —
preset walls, auto-design, construction-plan output (plan view + elevations, extending `F3`).
**Direction 2:** 2–3 storey whole-house customisation — plan views, elevations, cross-sections,
multiple cameras. Which comes first, and do they share one codebase?

**Recommendation: Direction 1 first. One codebase. Direction 2 behind the existing hybrid gate,
deferred to Phase 3.** Reasoning, strongest first:

1. **Direction 1 is the only one that sells cabinets.** Brown Box Kit's revenue is flat-pack kitchen
   SKUs through a Shopify cart. Every part of D1 shortens the path from landing page to Send-to-Cart:
   preset walls remove the drawing step, auto-design fills the room, construction plans give the
   customer a reason to trust the order. A whole-house designer adds no SKU to any cart — it is an
   architectural tool that happens to sit next to the product.
2. **Most of D1 is already paid for.** The auto-design solver is built and unit-tested (Track 2),
   waiting on wiring; the preset rectangle exists (`C1` is a cosmetic defect in its outline, not a
   missing feature); construction drawings extend the jsPDF + autoTable path that already ships the
   quote PDF (`1.8`). D1 is largely *finishing*, not *starting*.
3. **D2 forces the one change the house rules protect.** Multi-storey means walls and items stop
   being two flat arrays and become per-level collections — i.e. a `scene_json` shape change plus a
   migration for every saved project, which `AGENTS.md` lists as ask-first, and Law P as the way live
   data gets corrupted. Cross-sections and multiple simultaneous cameras are new three.js
   infrastructure on top. That is the most invasive work on the board, aimed at the direction that
   earns least.
4. **D1 unblocks the stated differentiator.** Complete Units (Track 6 `U2`) are the thing that beats
   IKEA, and they land inside a simple guided kitchen flow — a one-tap unit means little in a
   free-form three-storey house editor.

**One codebase, not a fork.** `main.js` is a deliberate ~9,750-line single file; forking it doubles
every future fix and every merge, and the June 2026 incident (a day of work stranded on an unmerged
branch) is the standing precedent for what happens to parallel lines of work here. Use the mechanism
already in the repo instead: the hybrid rollout gate (role `super_admin`/`hq_admin`/`admin` **or**
`?param=1`, default OFF, hard kill switch) that Track 2 uses and `DIY-MODE-PLAN.md` reuses.

| Stays shared (never duplicated) | Direction-2 only (gated, built later) |
|---|---|
| `walls` / `placedItems` scene state + save/load | per-level scene model + its migration |
| Shopify catalogue layer (`planner.*` metafields) | cross-section camera |
| quote panel / CSV / PDF / Send-to-Cart | multi-viewport camera layout |
| Supabase auth + projects + RLS | storey navigation UI |
| undo/redo, touch + mouse input layer | |

**Cost of deferring D2: near zero, with one cheap guard.** When `U2` next bumps `scene_json`
(to v5), *reserve* an optional per-object `level` field defaulting to `0` rather than building
multi-storey. That is one field and a default, not speculative machinery, and it means D2 later adds
levels instead of re-versioning every saved project a second time. ⚠ It is still a scene-state shape
decision, so it needs H's (or Opus's) explicit sign-off inside the `U2` brief — O is recommending it,
not taking it.

**The one thing that would flip this recommendation.** If D2 is aimed at a *different customer* —
builders or designers doing whole houses, on a different price model, perhaps a paid tier — then it
is a second product with its own revenue, and sequencing it behind D1's polish may be wrong. O cannot
answer that: it is a commercial call. **H: if D2 has its own paying customer in mind, say so and O
will re-do this recommendation from that premise.**

**What O needs from H (one decision).** Confirm *"Direction 1 first, one codebase, D2 gated"* — or
override with the direction you want. Until this is answered, Track 6 `U2` stays unscheduled by
design, because the unit UI should be designed once for whichever direction carries it.

---

### 2026-08-19 · O → A · CORRECTION ×3 + the add-on ruling recorded (docs-only, pre-merge)

**Author:** `O-opus-19aug26-b` — O, PM (Opus cloud agent, second session of 19 Aug; cold start, no
memory of the first session's chat)
**Board items:** Bug brief `C3`, `1.18`, Track 6 `U0` (`UNIT-SKU-PLAN.md` §3/§4), new `C8`, new `1.19`
**Claim level:** applied to the docs — **no `.js`/`.html`/`.css` touched by this commit**
**Supersedes:**
1. the `- [x] ⏳ C3` checkbox pushed in commit `0635018`;
2. the phrase **"byte-identical"** on the `1.18` board line, and the equivalent **"CSV bytes … are all
   identical to the pre-change baseline"** wording in the 1.18 log entry further down this file (that
   entry is left untouched per the append-only rule — this is the superseding correction);
3. the `UNIT-SKU-PLAN.md` §3 claim that store-only parts are already excluded "via `planner.category`
   … no code change needed".
**Instruction received (from H, 19 Aug 2026):** push one docs-only correction commit covering the four
points below, pre-merge, with A auditing before the merge.

**Correction 1 — C3 was half-ticked.** The board line read `- [x] ⏳`. The ⏳ was right and the `[x]`
was not: the status convention says ✅ only after H live-verifies, and a checked box reads as done to
anyone skimming the board. Set back to `- [ ] ⏳`. The convention line in `TASKS.md` now states
explicitly that `[x]` and ✅ move together and never separately, so the same half-tick cannot be
argued as compliant next time (Law S — the rule needed to name the checkbox to bite).

**Correction 2 — "byte-identical" was an overclaim.** The 1.18 no-op proof compared the feature-off
output against the pre-change baseline across CSV, PDF text, on-screen total and cart `lines`. The
**CSV is not byte-identical**: 1.18 deliberately prepends a UTF-8 BOM (`\uFEFF`) so Excel on Windows
renders the `↳` marker and any non-ASCII Shopify product name correctly. That is a real, intended
byte-level difference, and it was named in the same relay entry two paragraphs below the word
"byte-identical" — so the file contradicted itself. The claim is now
**"content-identical (the CSV differs only by the deliberate UTF-8 BOM)"**. The underlying evidence
is unchanged and still holds; only the word was wrong. Flagging rather than quietly rephrasing,
because a reader who checked the CSV byte-for-byte would have found a mismatch and been right to
distrust the rest of the proof.

**Correction 3 — the store-only exclusion did not exist.** `UNIT-SKU-PLAN.md` §3 asserted that
store-only parts were kept out of the planner "via `planner.category` … No code change needed; this
is a data convention for U0." **A verified this at file level and it is false.** `renderProductPanel`
contains no category filter of any kind: it groups everything in `products` by `productType` and
renders all of it. The only exclusion anywhere in the load path is the `(Draft)` title filter in
`loadShopifyProducts`. Nor does "carry no `planner.*` metafields" hide a product — the
`600×720×580` + placeholder-box fallbacks exist precisely so such a product still renders. So the
moment H published a hinge or a leg to the Storefront for U0, it would have appeared in the
catalogue as a placeable cabinet. §3 now says the mechanism does not exist and is being built, and
records that U0 must not publish parts until it lands. This is the most serious of the three: the
other two mislabel evidence, this one would have shipped H straight into the failure.

**Ruling recorded — `component_skus` intent is ADD-ON.** Confirmed by A+H on 19 Aug 2026. Each
component is its own priced cart line **on top of** the anchor cabinet's own variant; it is **not**
a bill of materials whose parts the parent price already covers. O ruling 1 (previous session)
therefore stands exactly as built, and no amendment to the S6 brief is needed. This closes the
overcharge risk that gated Track 6 U0 and gate (i) of board item `1.18`. Recorded in four places so
it cannot be lost: `TASKS.md` 1.18 gate (i) → SATISFIED, `UNIT-SKU-PLAN.md` §3 (v1 contract) and §4
(U0 entry gate), and standing-register item 7 above.

**Two new board items raised while doing the above** — both were found by reading the merged-pending
code, and both **gate H's next action**, so they are on the board rather than only here:
- **`C8`** — 1.18 follow-up code fixes. (a) `parseComponentSkus` quantity edges: `qty: 0.4` is
  silently promoted to **1**, `qty: 2.7` is silently floored to **2**, and a present-but-unreadable
  `qty` (`"two"`, `Infinity`) silently becomes **1** — all three invent a quantity, which is exactly
  what O ruling 4 was written to forbid, and component prices now reach the customer's total.
  (b) The audit tool's resolved-set is built from **all fetched nodes, drafts included**, while the
  runtime resolves against `products`, which drops drafts — so `?catalogaudit=1` can print `OK` for a
  component that will render as "Unknown component / $0.00" and that Shopify may reject, failing the
  whole cart. R4 step 4 tells H to trust that column, which makes a falsely-reassuring `OK` worse
  than no column at all. **Both gate R4.**
- **`1.19`** — the store-only catalogue filter from correction 3. **Gates U0.**

**Evidence:** this commit's diff — `TASKS.md` (C3 checkbox, convention clarification, 1.18 line,
new `C8`), `UNIT-SKU-PLAN.md` (§3 v1 contract, §3 store-only bullet, §4 U0 gates), `RELAY.md` (this
entry, author row, standing register). `npm run build` re-run and passing, though no code changed.

**Asks of A:** (1) confirm the three corrections are complete — specifically that no other file still
claims byte-identity or a working store-only exclusion (O grepped: `byte-identical`/`CSV bytes`
appear nowhere else, and the only remaining `byte-for-byte` is S1's unrelated no-param claim in
`S-BRIEFS-ITEMS-0-5.md`); (2) note that `C8` and `1.19` were raised by O against O's own prior
cycle, not found by audit.

**Blocked on:** nothing for this entry.

---

### 2026-08-19 · O → A · Staging decision: Complete-Unit SKU system recorded as spec + board scope, NOT built

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Board items:** new Track 6 (`UNIT-SKU-PLAN.md`), new future-scope F6–F9, new polish C7
**Claim level:** documentation only — no `.js`/`.html`/`.css` touched, planner code unchanged

**Instruction received (from H, 19 Aug 2026):** before building the Complete-Unit SKU system, H
asked what "build" would do and where it belongs in sequence, given the open queue (auto-design
mid-flight, snap imperfections, login gate, analytics, the Direction 1/2 product split, and the
rest of the board). H then approved O's recommendation: **record it as scope, do not build**, and
also record every scope H mentioned that was not yet on the board.

**Decisions recorded.**
1. **U2/U3 of the unit system are NOT scheduled.** Entry gates written into `UNIT-SKU-PLAN.md`
   §4: U2 needs U0 (owner companion-SKU data) + 1.18 live-verified + the F8 direction ruling;
   U3 additionally needs Track 2 auto-design live. Rationale: the data does not exist in Shopify
   yet, 1.18 (which U2 builds on) is itself not live, and the Direction 1/2 split changes how the
   unit UI should be designed — building now would ship a second dormant, untestable layer on top
   of a first one.
2. **New board scope added from H's 19 Aug message** (previously chat-only, which Law S treats as
   decoration): F6 login-before-access · F7 real analytics + copycat control · F8 Direction 1/2
   split ruling (explicitly gates Track 6 U2) · F9 "3D photos" (needs one H clarification:
   renders vs the existing 1.3 camera capture) · C7 snap imperfection (needs an H repro note).
   Auto-design and construction-plan output were already on the board (Track 2, F3) — not
   duplicated.
3. **Track 6 section added to TASKS.md** with the U0–U3 ladder, so the unit system has a board
   home and its "not scheduled" state is on the board rather than implied.

**Evidence:** `UNIT-SKU-PLAN.md` (new), TASKS.md diff (programme-map row, Track 6 section,
F6–F9, C7), this entry. Commit to follow on the same branch as the C3+1.18 work.

**Asks of A:** (1) audit that the entry gates in `UNIT-SKU-PLAN.md` §4 match the standing
1.18 rulings (esp. add-on vs BOM gate before U0); (2) note F8 is a 🧠👤 ruling H+O must make
before any U2 brief exists — hold any U2 proposal that appears without it.

**Blocked on:** nothing for this entry. Standing register unchanged — items 1–8 still open.

---

### 2026-08-19 · O → A · H ruling applied: every entry, report and prompt must name its author

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Board item:** none — this is a governance amendment to this file, not planner work. Flagging that
explicitly per Law B rather than inventing a board item to sit under.
**Claim level:** applied to this file (documentation change only; no code touched)

**Instruction received (from H, 19 Aug 2026):** "Relay Md should have the author in every prompt, or
report."

**What changed.**
1. Authorship is now the **first rule** in § How to use it, not a footnote. Law S: a rule at the top
   of the loaded file beats the same rule mid-document, so it is placed where a fresh session will
   actually read it before writing.
2. Added § **Authors & sessions** — a tag table mapping each author tag to the real agent or human
   plus its session id, so a claim can be traced to a specific run rather than to a role letter.
   `O` is a seat, not an identity; several sessions can occupy it in one day.
3. The entry template now carries a `**Author:**` field marked MANDATORY, plus an optional
   `**Relaying work by:**` field, because most O entries report S's or the reviewer's output and the
   two should not be conflated: the author is whoever stands behind the entry, not whoever did the
   work being described.
4. **Retro-fitted every pre-existing section** — all 7 log entries, the standing register, and
   runbooks R1–R5 now name their author. This is the one edit the append-only rule permits, since it
   adds provenance without altering a claim; that exemption is now written into the rule itself.
5. Runbooks are explicitly in scope, since H said "prompt **or** report". Each `R#` is a prompt to H,
   so each signs itself. R4 additionally records that its Shopify Admin steps were **not** executed
   by their author and so may not match the current Admin UI (Law M) — exactly the kind of thing an
   unattributed runbook hides.

**Why this matters beyond bookkeeping.** Three of this cycle's entries are things O has asked A to
rule on, and one is a **correction withdrawing O's own earlier PASS**. Any of those is worthless if A
cannot tell which session made the claim: A cannot weigh a source it cannot identify, and Law K asks
A to hold the line against pressure — which requires knowing who is applying it.

**Evidence:** 13 authored sections, verified by grep — every `###` log entry, every `R#` runbook, and
the standing register carry an `**Author:**` line directly under their heading. No `.js`, `.html`, or
`.css` file touched.

**Ask of A:** if you want authorship enforced rather than merely written down (Law S: a blocking hook
beats prose), the natural mechanism is a CI check that fails when a `###` entry in this file has no
`**Author:**` line within two lines of its heading. O has not added one — that is a repo-tooling
decision for H.

---

### 2026-08-19 · O → A · CORRECTION + upgraded C3 evidence: first manual test was invalid, real control test now passes

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Board item:** TASKS.md 🔴 Bug brief `C3`
**Claim level:** **verified-local on the production bundle, with a control** — still not verified-live
**Supersedes:** the evidence paragraph in the C3 entry below (the fix and the commit are unchanged)

**Correction first.** O ran a manual GUI smoke test in the VM's desktop Chrome: place cabinet →
Send to Cart → real Shopify checkout → browser Back. The tester reported the button came back green
and called C3 PASS. **That run did not prove anything.** Video review showed the Back navigation
triggered a **fresh page reload**, not a bfcache restore — the "Resume your unsaved design?" modal
appeared, which only happens on a cold boot. On a fresh load the button is enabled straight from
`index.html`, so it would have looked correct **with or without the fix**. O nearly shipped a
green tick on a test that could not fail. Flagging it rather than quietly replacing it.

**Why the manual test could not exercise the bug.** Not an app defect. The planner's own cache
headers are bfcache-eligible (`no-cache`, not `no-store`; live Vercel sends
`public, max-age=0, must-revalidate`). The blocker is the **test browser**: Chrome as launched in
this environment does not put pages into the back/forward cache unless it is started with
`--enable-features=BackForwardCache` and without `--disable-back-forward-cache`. That is a
**testing-environment finding worth carrying into `SMOKE-SCRIPT.md`** — a tester pressing Back in a
default automation browser will silently get a reload and report a false PASS on any bfcache bug.
O has not edited that file; recommending it to H/A.

**The evidence that does hold.** O rebuilt the **pre-fix commit** (`e3a4ec1`) as a second production
bundle and ran the identical scenario against both, with bfcache genuinely forced on. Each run does
a real Send-to-Cart click → real `cartCreate` → real cross-origin navigation to
`checkout.brownboxkit.co.nz` → real history Back. bfcache is proven **two independent ways**: a
marker planted on `window` before leaving survived the Back (so the document was never
re-executed), and `pageshow.persisted === true`.

```
--- WITH fix    (HEAD) ---            --- WITHOUT fix (e3a4ec1) ---
restored from bfcache : true          restored from bfcache : true
pageshow.persisted    : [true]        pageshow.persisted    : [true]
button label          : "🛒 Send to Cart"   button label    : "Adding to cart…"
button disabled       : false         button disabled       : true
VERDICT               : USABLE        VERDICT               : STUCK (bug reproduced)
```

Both builds were also confirmed to enter the `disabled` + "Adding to cart…" state on the way out,
so the difference is genuinely the restore path and not a failure to reach it. The pre-fix worktree
has been removed (`git worktree list` shows only `/workspace`), and the harness lives in `/tmp` —
`git status` is clean.

**Asks of A:** (1) note that the first manual PASS was withdrawn by O rather than by audit; (2) rule
on whether `SMOKE-SCRIPT.md` should carry the bfcache browser-flag caveat, since any future
back-navigation test by a browser-only tester is exposed to the same false PASS.

---

### 2026-08-19 · O → A · Real-world finding for the pending out-of-stock ruling (C3 related decision)

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Relaying work by:** observed during O's own C3 live-checkout testing
**Board item:** Bug brief `C3` → "_Related owner decision: out-of-stock cabinet handling at
checkout_" (awaiting an A ruling), and Track 1 `1.15c` item #6 OOS
**Claim level:** observed on the live store, incidental to C3 testing

**What happened.** Every Send-to-Cart during C3 testing reached the real
`checkout.brownboxkit.co.nz` successfully, and the checkout then displayed an **"Out of stock"
dialog** — the cabinets used for testing are sold out in Shopify. The cart was created and the
line items and subtotal rendered correctly ($117.30 for one `#1 Base Cabinet 150mm`), so the
planner side is behaving; the block appears at the checkout step.

**Why this matters for the ruling.** It is live confirmation that a customer can design a kitchen,
click Send to Cart, and land on a checkout they cannot complete — with no warning inside the
planner. The planner currently reads `availableForSale` per variant (`shopifyNodeToProduct` maps it
to `sku.available`) but does **not** gate placement or Send-to-Cart on it. So the data needed to
warn the customer earlier is already in hand.

O is deliberately **not** briefing a fix: the board says the Shopify inventory setting decision
precedes any code, and that ruling is A's. This entry is the field evidence for it.

**Ask of A:** when ruling, note that the choice is not only "continue selling when out of stock" in
Shopify — there is also a planner-side option (surface `sku.available` in the catalogue panel and/or
warn before Send-to-Cart) that needs no Shopify change. O can brief either once you rule.

---

### 2026-08-19 · O → A · Post-task smoke checklist run (AGENTS.md) — one item genuinely blocked

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Relaying work by:** a GUI test agent driving desktop Chrome under O's instruction, plus S's 390px
touch run. O reviewed every result and signs for this table.
**Board items:** all four in this cycle (the checklist is mandatory after ANY task)
**Claim level:** verified-local on the dev build, desktop; touch partly covered

Run against the committed tree. Results:

| Checklist item | Result |
|---|---|
| Quote CSV + PDF export | **PASS** — both download; CSV `kitchen-quote.csv`, PDF `brown-box-kit-quote-2026-08-19.pdf` |
| Undo / redo | **PASS** — `$272.44` → `$0.00` → `$272.44`, stepping one cabinet at a time. Note `Ctrl+Y` works, `Ctrl+Shift+Z` did not |
| Cabinets sit on the 300mm slab (place) | **PASS** on place |
| Cabinets sit on the slab (save → reload) | **BLOCKED** — needs a signed-in Supabase session; no test account available to an agent |
| Save Project in hamburger | **BLOCKED** — prompts Google sign-in as expected; O did not authenticate and entered no credentials |
| Restart Planner in hamburger | **PASS** — confirmation prompt, then clean blank reset, no errors |
| Power point button in elevation | **PASS** — `+ Power Point` present in elevation, sockets placed |
| Door/window select + drag along wall with dims | **PASS** — green highlight, stays wall-locked, dimensions update during drag |
| Zoom speed with a cabinet selected | **PASS** — smooth and proportional, no regression of the old jumpy-zoom bug |
| Long-press select on touch | **PASS** (covered in S's 390px touch run: tap-place ×2 → `$741.64`, undo → `$370.82`, redo → `$741.64`) |
| 1.18 invisible with no metafield | **PASS** — quote lines show name/variant/price only, no `↳` sub-lines |

**Honest gaps.** The two save/load rows are **not** verified and are not claimed as such. They are
the highest-value items for H to cover, because 1.18 deliberately does not persist components and
the "cabinets on the slab after reload" check is the standing regression for `scene_json`. No red
console errors were observed in any run.

**Also noted:** the tester could not find a **preset rectangle** option and had to draw the room
with Free Draw. Board item `C1` concerns the preset rectangle's outline, so it presumably exists —
possibly behind a popup the tester missed. Not investigated; logging in case it is a real
regression rather than a discovery failure. 👤/🧠 worth one H check.

---

### 2026-08-19 · O → A · ⚠ Live catalogue drift observed — does NOT lift the 1.15c hold

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Relaying work by:** S's 1.18 test harness incidentally captured the counts; O verified and reports
them, and O is the one refusing to move the board on them.
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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Relaying work by:** S (Composer) wrote the code to O's re-issued S6 brief; the reviewer subagent
returned the fix-then-ship verdict. The four rulings below are **O's own** and O owns them.
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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)
**Relaying work by:** S (Composer) wrote the fix to O's brief S8; the reviewer subagent returned the
ship verdict. **Note:** the evidence paragraph in this entry was later superseded by O's own
production control test — see the CORRECTION entry at the top of the log.
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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent). First entry in this file.
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
>
> **Runbooks are prompts, so they are authored too** (H ruling, 19 Aug 2026). Each `R#` below carries
> its own `**Author:**` line. If you revise someone else's runbook, add your tag and say what you
> changed — do not silently inherit theirs, because H needs to know who to go back to when a step
> does not match reality (Law M: a mismatch means the author skipped verification).

### R1 · 1.15c — Shopify catalogue data pass  (unblocks nothing else; safe to do any time)

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)

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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent). The SQL files themselves were authored
earlier by another session and are unchanged by this cycle; O wrote only these apply steps.

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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)

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

### R4 · 1.18 — how to switch Component SKUs on

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent). Steps 1–2 are Shopify Admin procedure that
O has **not** executed and cannot verify from here (Law M) — if a menu path differs, that is on this
author, so report it rather than guessing.
**Revised by `O-opus-19aug26-b` (O, PM, second session 19 Aug):** removed the BOM-vs-add-on hold now
that A+H have confirmed ADD-ON; added the § "Before step 1" block below (the internal-parts data rule
and the two code gates). Steps 1–7 themselves are unchanged and remain the original author's.

#### Before step 1 — three things that will cost real money if skipped

**(a) The intent is settled: ADD-ON.** A+H confirmed on 19 Aug 2026 that each `component_skus` entry
is its own priced cart line **on top of** the anchor cabinet. The old BOM hold on this runbook is
lifted.

**(b) ⛔ NEVER list a cabinet's own internal parts.** Because components are charged on top, and a
cabinet SKU already includes its carcase, legs, hinges and door panels in its own price, listing any
of those here **double-charges the customer** — on the quote, the CSV, the PDF and the real cart at
once. No code can catch it: a hinge variant is a valid variant id, so the planner will resolve it,
price it, and add it. Only correct data prevents this.
- ✅ list only genuinely extra products: benchtop, sink, oven, hob, tap.
- ❌ never list hinges, legs, fronts, carcase panels, fixings, or handles supplied with the unit.
- Rule of thumb: *if the customer would receive it anyway by buying this cabinet alone, it must not
  be listed.* Those parts are store-only SKUs instead (`1.19`).

**(c) ⛔ Wait for board item `C8` to be on `main`.** Two known defects in the 1.18 code make this
runbook unsafe until they are fixed: a `qty` the parser cannot read (`0.4`, `2.7`, `"two"`) silently
becomes a quantity nobody chose, and **step 4's `OK` cannot be trusted** — the audit resolves
component variants against all fetched products *including drafts*, while the planner resolves
against published products only, so a component on a Draft product reads `OK` here and then arrives
in the planner as "Unknown component / $0.00" and can make Shopify reject the entire cart. Ask O to
confirm `C8` is merged before you set a single metafield.

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

**Author:** `O-opus-19aug26` — O, PM (Opus cloud agent)

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
