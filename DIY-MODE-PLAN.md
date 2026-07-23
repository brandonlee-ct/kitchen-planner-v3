# DIY Guided Mode — Architecture & Execution Plan (v1, spec-first)

**Project:** Brown Box Kit Kitchen Planner — DIY Guided Mode
**Target:** NZ DIY / first-time customers who find the blank planner intimidating
**Status:** ✅ SIGNED OFF by H, 24 Jul 2026 (Part 6). Steps 1–2 (**DIY-2**) are cleared
to build; Steps 3–5 each still need their own gate. Mirrors `AUTO-DESIGN-PLAN.md`.
**Board item:** `TASKS.md` Track 5 / **DIY-1** (this document). The first build round
is **DIY-2** (Steps 1–2 only).
**Authored by:** O (PM Opus), from the approved plan
`.cursor/plans/planner_improvements_items_0-5_8598fb14.plan.md` (Item 4).

> **Relationship to Auto-Design.** DIY mode and Auto-Design are siblings, not rivals.
> Auto-Design is the "magic button" (solver lays out a whole kitchen from a short spec).
> DIY mode is the **opposite pedagogy**: it holds the beginner's hand through the same
> underlying tools they'd use manually — draw the room, add openings, pick a look, drag
> cabinets in, then run a compliance check. DIY **reuses the Auto-Design wizard chassis**
> (`auto-design-wizard.js`) for its modal, and **extends the same rules module**
> (`auto-design-rules.js` `NZ_BUILDING_RULES`) for its Step 5 checker. It does **not**
> fork either file.

> **Why this doc exists before any code.** Per `ROLES.md`, Opus turns an approved spec
> into S# briefs; per `LESSONS-LEARNED.md` Law B/N, no DIY code is written until this
> plan is signed off. Two decisions in here are **owner rulings** (mood-board storage,
> NZBC value authority) — they are flagged, not silently chosen.

---



## Part 1 — System Architecture



### 1.1 Module boundaries

DIY mode adds **one new file** and reuses three existing ones. It follows the exact
separation Auto-Design established (§1.1 of `AUTO-DESIGN-PLAN.md`): the wizard owns spec
state + modal DOM and never touches `scene`/`walls`/`placedItems`; `main.js` owns all
scene mutation and is the only thing that calls the room/opening builders.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (single SPA)                          │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │   main.js        │  │ diy-wizard.js (NEW)  │  │  auth.js        │  │
│  │   (existing)     │◄─┤  • 5-step modal      │  │  • Supabase     │  │
│  │  • Three.js      │  │    (reuses the       │  │  • mood-board   │  │
│  │  • buildWall     │  │     auto-design       │  │    read (if     │  │
│  │  • addOpening    │  │     modal shell)      │  │    Supabase     │  │
│  │  • syncOpeningsTo3D│ │  • DIY spec owner    │  │    ruling)      │  │
│  │  • placeProduct  │  │  • step validation   │  └─────────────────┘  │
│  │  • ~150 lines    │  │  • NEVER touches      │                       │
│  │    orchestration │  │    scene/walls        │                       │
│  └────────▲─────────┘  └──────────┬───────────┘                       │
│           │  ctx callbacks         │ onStepCommit / onFinish            │
│           │  (buildRoom, addOpening, highlightWall, runNzbcCheck…)      │
│           │                        ▼                                    │
│           │            ┌──────────────────────┐                        │
│           └────────────┤ auto-design-rules.js │  ◄── EXTENDED (not     │
│                        │  • NZ_BUILDING_RULES │      forked): new G3/   │
│                        │  • checkNzbcClearances (NEW)  AS1 clearance    │
│                        └──────────────────────┘      keys + a checker   │
└────────────────────────────────────────────────────────────────────────┘
```

**One new file:** `diy-wizard.js` (ES module, same shape as `auto-design-wizard.js`).
`index.html` gains a `#diy-modal` shell (or a shared modal — see §1.3) and a DIY toolbar
button. `auto-design-rules.js` gains additive exports. `main.js` gains a small
`// ── DIY Mode ──` orchestration section (~150 lines, single section to keep the
merge-conflict surface small — same discipline as Auto-Design §1.8).

### 1.2 Hard architectural rules (inherited from Auto-Design §1.2)


| Rule                                                                                                                                                                     | Why                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `diy-wizard.js` never imports Three.js/DOM-scene state; it talks to `main.js` only through a `ctx` object of callbacks                                                   | Wizard stays replaceable; `main.js` merge surface stays tiny                         |
| `auto-design-rules.js` stays pure (no Three.js, no DOM, no `main.js` import) even after the NZBC extension                                                               | It's the unit-testable seam and is shared with Auto-Design                           |
| All DIY→scene mutation goes through **existing** `main.js` functions (`buildWall`, `addOpening`, `syncOpeningsTo3D`, `placeProduct`) — DIY adds **no** new scene-builder | No refactor of working code (AGENTS.md); reuse the tested paths                      |
| Every DIY action that mutates the scene calls `pushHistory(...)` through the same path the manual tool already uses                                                      | Undo/redo stays intact (AGENTS.md) — DIY introduces no un-undoable action            |
| Element IDs in `index.html` are the contract                                                                                                                             | `diy-wizard.js` binds to them; never rename one side only                            |
| DIY reuses the **hybrid rollout gate** pattern verbatim (§1.4)                                                                                                           | One proven gate mechanism; default OFF; kill switch                                  |
| Mood-board data is **read-only** in the planner for v1 (admin edits happen out-of-band)                                                                                  | Keeps the planner free of an admin CRUD surface until an owner ruling says otherwise |




### 1.3 Chassis reuse — how DIY plugs into `auto-design-wizard.js` without forking

The Auto-Design wizard is a self-contained modal engine. The reusable machinery, by real
symbol name in `auto-design-wizard.js`:

- **Lifecycle / public API:** `initAutoDesignWizard(ctx)`, `openAutoDesignWizard(prefillSpec, startStep)`,
`closeAutoDesignWizard()`, `isOpen()`.
- **Navigation:** `goNext()` / `goBack()` driven by `step` + `MAX_STEP`, with `renderStep()`
dispatching to `renderStep1..4`. Footer shows `Step N of M` via `elStepLabel`; Back is
hidden on step 1; Next→Generate swap on the last step.
- **Modal shell + a11y:** `#auto-design-modal` / `#ad-step-body` / `#ad-back` / `#ad-next` /
`#ad-generate` / `#ad-step-label` / `#ad-close` / `#auto-design-backdrop` / `#ad-footer`;
`document.body.classList.add('ad-modal-open')` locks body scroll; `Escape` closes;
`trapFocus()` cycles Tab inside the modal; first focusable is auto-focused per step.
- **Touch sizing / breakpoints:** the `.ad-`* classes are already sized for 44px touch
targets and respect the existing 430px/768px breakpoints — DIY reuses them.
- **Analytics stub:** `ctx.trackEvent(name, props)` (wizard already fires `wizard_opened`,
`wizard_step_advanced`, `wizard_step_back`, `wizard_cancelled`, etc.).

**Chosen reuse strategy — "parameterise the chassis, own a copy of the step bodies."**
Two options were considered:

- **(A) Generalise** `auto-design-wizard.js` into a shared `wizard-core.js` and have both
Auto-Design and DIY import it. Cleanest long-term, but it **refactors working, shipped
code** — against AGENTS.md house rules and risky mid-flight.
- **(B) Create** `diy-wizard.js` **as a sibling** that reuses the same **modal shell markup +**
`.ad-*` **CSS + a11y patterns** (the actual reusable surface) and re-implements the 5 step
bodies for DIY. `MAX_STEP = 5`. It talks to `main.js` through a DIY `ctx`.

**Decision: (B) for v1** (see Part 5, Decision #1). It honours "add, don't refactor,"
keeps Auto-Design untouched, and the duplicated machinery is small (~60 lines of
nav/lifecycle). A later consolidation into `wizard-core.js` is a roadmap item, not this
feature's job. `diy-wizard.js` may either (b1) reuse the **same** `#auto-design-modal`
shell with DIY-specific bodies, or (b2) add a parallel `#diy-modal` shell with the same
IDs prefixed `diy-`. **b2 is preferred** so DIY and Auto-Design can't collide on shared
DOM/state; confirm at build time that the extra markup is null-safe (`if (!elModal) return;`
pattern already in `initAutoDesignWizard`).

### 1.4 Rollout gate — DIY equivalents of the Auto-Design hybrid gate

Mirror the Auto-Design gate in `main.js` (`AUTO_DESIGN_DEFAULT`, `AUTO_DESIGN_ADMIN_ROLES`,
`computeAutoDesignEnabled()`, `window.AUTO_DESIGN_ENABLED`, `?autodesign=1` → localStorage
`bbk_autodesign`, hard kill `window.AUTO_DESIGN_KILL`). DIY names:


| Auto-Design                                                                           | DIY equivalent                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `AUTO_DESIGN_DEFAULT` (const, flips at launch)                                        | `DIY_DEFAULT` (default `false`)                                           |
| `AUTO_DESIGN_ADMIN_ROLES`                                                             | `DIY_ADMIN_ROLES = ['super_admin','hq_admin','admin']`                    |
| `?autodesign=1` → `localStorage['bbk_autodesign']='1'`                                | `?diy=1` → `localStorage['bbk_diy']='1'`                                  |
| `computeDiyEnabled()` = kill? false : DEFAULT? true : localStorage? true : role∈admin | (same logic)                                                              |
| `window.AUTO_DESIGN_ENABLED`                                                          | `window.DIY_ENABLED`                                                      |
| `window.AUTO_DESIGN_KILL`                                                             | `window.DIY_KILL` (hard kill overrides all; re-run `computeDiyEnabled()`) |


The DIY toolbar button and any DIY menu entry render **only when** `window.DIY_ENABLED` **is
true** (wired null-safe: `const b = document.getElementById('btn-diy'); if (b) b.addEventListener(...)`).
Flipping `DIY_DEFAULT` to `true` is the business-launch switch; setting `window.DIY_KILL = true`
is the post-launch kill switch. **Verify the kill switch in the same session it's wired**
(flip in DevTools → button disappears; flip back → returns), exactly as Auto-Design Task 3.2
step 5 requires.

### 1.5 State ownership


| State                                                                                 | Lives in                                                                          | Touched by                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `walls`, `placedItems`, `settings`                                                    | `main.js` module scope                                                            | DIY ctx callbacks (via closures only), undo/redo, save/load |
| `diySpec` (room size, per-wall openings, chosen mood board, placed-cabinet checklist) | `diy-wizard.js` module scope                                                      | wizard only                                                 |
| Mood-board catalogue (4 launch palettes + any admin additions)                        | Supabase table **or** Shopify metaobjects — **OWNER RULING, §Part 5 Decision #3** | read-only fetch at wizard open; wizard renders              |
| DIY modal DOM                                                                         | `index.html` `#diy-modal`                                                         | wizard module only                                          |
| NZBC clearance results                                                                | transient — computed by `checkNzbcClearances()` each Step 5 render                | wizard renders; never persisted                             |


**DIY writes no new keys to** `scene_json`**.** A DIY-built kitchen is just walls + openings +
placed items — indistinguishable from a manually drawn one — so it round-trips through the
existing `serialiseScene()`/`loadScene()` with **no version bump**. (Contrast S5, which is
the only Items 0–5 brief that bumps `scene_json`.) If a future round wants to remember
"this project was built in DIY mode" or its chosen palette, that is an additive,
version-bumped change to be specced then — **out of scope here**.

### 1.6 Data flow — one DIY session

```
User taps 🧱 Design it with me (DIY toolbar button, visible only when DIY_ENABLED)
   ↓
openDiyWizard()                         wizard resets diySpec to a default square room
   ↓
[Step 1: room size]   walls/ceiling  ──► ctx.buildSquareRoom(widthMm, depthMm, ceilingMm)
   ↓                                        (main.js builds 4 walls via buildWall ×4,
   │                                         one add-wall-batch history entry)
[Step 2: openings]    doors/windows/ ──► ctx.addOpening(wallIndex, type, params)
   │                  power points         (main.js: addOpening + syncOpeningsTo3D)
   ↓
[Step 3: mood board]  pick a look    ──► diySpec.moodBoard = <paletteId>  (no scene change)
   ↓
[Step 4: guided       drag cabinets  ──► normal placeProduct path; wizard shows a checklist
         drag-drop]                        + "highlight where this goes" hints
   ↓
[Step 5: NZBC check]  run compliance ──► ctx.runNzbcCheck() → checkNzbcClearances(walls,
   ↓                                        placedItems, NZ_BUILDING_RULES) → warnings[]
User taps Finish       ──► closeDiyWizard(); scene already reflects every step (DIY mutates
                            live, unlike Auto-Design which batches into one Generate)
```

**Key difference from Auto-Design:** Auto-Design previews then commits one batched
`auto-design-replace` entry. **DIY mutates the live scene at each step** using the existing
tools, so every action is individually undoable exactly as if the user did it by hand. This
is deliberate — DIY is teaching the manual tools, not replacing them.

---



## Part 2 — Phase Plan


| Phase                        | Scope                                                                                                   | Build round               | Gate                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| 0 — Sign-off                 | This document reviewed; Part 5 owner rulings answered                                                   | —                         | **H + O sign-off (Part 6)**            |
| 1 — Shell + gate + Steps 1–2 | `diy-wizard.js`, DIY button, hybrid gate, square-room start, Step 1 walls/ceiling, Step 2 openings/GPOs | **DIY-2** (first build)   | Reviewer + H device QA                 |
| 2 — Step 3 mood boards       | Read-only palette catalogue (storage per Decision #3); Step 3 UI                                        | DIY-3 (after Decision #3) | H ruling on storage first              |
| 3 — Step 4 guided drag-drop  | Placement checklist, per-item "where it goes" hints                                                     | DIY-4                     | Reviewer + H device QA                 |
| 4 — Step 5 NZBC checker      | `checkNzbcClearances()` + G3/AS1 keys; warnings drawer; disclaimer                                      | DIY-5                     | **Installer review gate** (§Part 5 #2) |


**Only Phase 1 (DIY-2) is authorised by the current board.** Phases 2–4 each get their own
S# brief after this doc is signed off and their specific gate is cleared. Free Draw
multi-storey is **out of scope for the entire DIY track** (future roadmap — §Part 4 note).

**Checkpoint discipline (AGENTS.md):** commit + push at the end of every DIY task; DIY work
lands on `main` (or a short-lived `feature/diy` branch merged same-day). Never strand DIY
work on an unrelated branch (June 2026 incident).

---



## Part 3 — Task Breakdown

> These are **proposed** S# briefs. O writes the actual bounded briefs (Law G) only after
> Part 6 sign-off. DIY-2 is the only one the current board greenlights to build.



### Phase 1 — Shell + gate + Steps 1–2  (board item **DIY-2**)



#### DIY-2.1 — DIY wizard shell + hybrid gate

Create `diy-wizard.js` reusing the Auto-Design modal shell/`.ad-*` CSS/a11y (§1.3, option
b2 preferred: `#diy-modal` with `diy-`-prefixed IDs). Public API mirrors Auto-Design:
`initDiyWizard(ctx)`, `openDiyWizard(prefillSpec=null, startStep=1)`, `closeDiyWizard()`.
`MAX_STEP = 5`. Wire the DIY gate in `main.js` (`DIY_DEFAULT`, `DIY_ADMIN_ROLES`,
`computeDiyEnabled()`, `window.DIY_ENABLED`, `?diy=1`→`bbk_diy`, `window.DIY_KILL`). Add the
`🧱 Design it with me` toolbar button, rendered only when `window.DIY_ENABLED` (null-safe
wiring). **Verify the kill switch in-session.**

- **Out of scope:** any step body logic beyond a stub; any scene mutation.
- **Done when:** button appears only under the gate; modal opens/closes/traps focus on
desktop + iPad; kill switch proven.



#### DIY-2.2 — Step 1: square-room start (walls + ceiling)

DIY starts from a **default square room** (e.g. 3000×3000mm) the user resizes with width /
depth / ceiling-height number inputs (reuse the Step-1 input pattern + `clampInt()` from
`auto-design-wizard.js`). On commit, `ctx.buildSquareRoom(widthMm, depthMm, ceilingMm)` in
`main.js` builds the 4 walls by calling the **existing** `buildWall(start, end, skipHistory, heightMm)`
four times (metres internally via `mm()`), grouped into one history entry so undo removes
the whole room. If the scene already has walls, prompt before replacing (reuse the
confirm-then-replace pattern; must stay undoable — do **not** call `clearScene()` which wipes
the undo stack; detach like Auto-Design's `detachSceneForReplace()` or simply require an
empty scene for v1 and flag the choice to O).

- **Reuses:** `buildWall` (main.js:1299), `mm()`, `settings.ceilingHeight`.
- **Done when:** resizing produces a correct square room on the slab; undo removes it;
touch + desktop verified.



#### DIY-2.3 — Step 2: doors / windows / power points

Reuse the Auto-Design Step-2 opening UI shape (per-wall `+ Window` / `+ Door` rows,
`renderOpenings`-style editors) **plus** a `+ Power Point` control. On commit, call the
**existing** `main.js` `addOpening(wallObj, type)` with `type ∈ {'door','window','gpo'}` —
the exact function the wall popup (`#wp-gpo`, main.js:2079) and elevation toolbar
(`#elev-add-gpo`, main.js:3434) already use. `syncOpeningsTo3D(wallObj)` renders them
(doors/windows/GPO meshes; power point = `op.type === 'gpo'`, main.js:3475). DIY must not
reimplement opening geometry — it only drives the existing tools with wizard-friendly
inputs and a `ctx.highlightWall(i)` hint.

- **Reuses:** `addOpening` (main.js:3515), `syncOpeningsTo3D` (main.js:3452),
`clearWallOpeningMeshes` (main.js:3593), the `gpo` opening type.
- **Done when:** adding a window/door/power point via the wizard produces the same result
as the manual tools; each is individually undoable; power point shows in elevation.



### Phase 2 — Step 3 mood boards  (board item DIY-3; blocked on Decision #3)



#### DIY-3.1 — Palette catalogue (read-only) + Step 3 UI

Seed the **four launch palettes** (§3-Mood-Boards below). Fetch them read-only at wizard
open (source per Decision #3). Step 3 renders palette cards (thumbnail + name + the
floor/base/wall/wall-colour description); selecting one sets `diySpec.moodBoard`. For v1 the
palette is **advisory** (it guides which products the user picks in Step 4 and can pre-filter
/ sort the product panel) — it does **not** auto-recolour placed cabinets. Auto-apply of a
palette's colours is a later enhancement, flagged, not built.

- **Blocked on:** Decision #3 owner ruling (Supabase vs metaobjects).



### Phase 3 — Step 4 guided drag-drop  (board item DIY-4)



#### DIY-4.1 — Guided placement

Step 4 shows a checklist ("add a sink base, add a hob, add wall cabinets…") and drives the
**existing** `placeProduct` flow — the user drags/taps products in as normal, and the wizard
tracks what's been added and shows "where this typically goes" hints via `ctx.highlightWall(i)`
and non-blocking tips. No new placement engine; no change to `placeProduct`'s signature.

- **Reuses:** `placeProduct` (main.js:4763), product panel, touch + desktop place paths.



### Phase 4 — Step 5 NZBC checker  (board item DIY-5; installer review gate)



#### DIY-5.1 — Extend `NZ_BUILDING_RULES` + `checkNzbcClearances()`

**Additively** extend `auto-design-rules.js` `NZ_BUILDING_RULES` with G3/AS1 kitchen
clearance keys (§5-NZBC below) and add a pure `export function checkNzbcClearances(walls, placedItems, rules)` that returns `warnings[]` in the same shape the wizard already renders
(`{ severity, message, wallIndex, ruleId }`, per `renderStep4`/`hasBlockingError` in
`auto-design-wizard.js`). Step 5 calls it via `ctx.runNzbcCheck()` and renders a warnings
list + the NZBC disclaimer (reuse the `AD_NZBC_DISCLAIMER` pattern / `#ad-disclaimer`
footer). All new rule values ship **flagged pending installer review** (`_meta.lastReviewed: null`; append " — values pending installer review" to each DIY NZBC warning, exactly as
Auto-Design Task 4.4 does).

- **Out of scope:** blocking Finish on warnings (advisory only for v1; errors are informational).
- **Gate:** installer review (§Part 5 #2).

---



## Step 3 — Mood boards (the four launch palettes)

All four share a **light timber floor**. They differ in cabinetry:


| #   | Name (suggested) | Floor        | Base cabinets       | Wall cabinets              | Walls                     |
| --- | ---------------- | ------------ | ------------------- | -------------------------- | ------------------------- |
| 1   | Grey & White     | Light timber | Grey floor-standing | White wall-hung            | White                     |
| 2   | Soft Two-Tone    | Light timber | White base          | Light-colour wall cabinets | (installer/owner default) |
| 3   | All White        | Light timber | White base          | White wall                 | (owner default)           |
| 4   | Full Timber      | Light timber | Timber-colour base  | Timber-colour wall         | (owner default)           |


Store each palette as a small JSON record, e.g.:

```json
{
  "id": "type-1-grey-white",
  "name": "Grey & White",
  "floor":       { "label": "Light timber", "hex": "#d9c3a5" },
  "baseCabinet": { "label": "Grey",  "hex": "#8d9299" },
  "wallCabinet": { "label": "White", "hex": "#f2f2f2" },
  "wall":        { "label": "White", "hex": "#ffffff" },
  "thumbnail":   "<url or asset path>",
  "sortOrder":   1,
  "active":      true
}
```

> **✅ OWNER RULED (H, 24 Jul 2026) — mood-board storage = Supabase (Part 5, Decision #3).**
> The palettes live in a Supabase `mood_boards` table. **The names and colours in the table
> above are PLACEHOLDERS only** — the admin user replaces/edits them later, so treat them as
> examples, not final. The chosen approach and rationale, for the record:
>
> **A Supabase** `mood_boards` **table**, read-only to
> the planner via the existing anon key **with RLS** (public read of `active = true` rows;
> writes restricted to admin roles — same posture as `projects`). Rationale: the planner
> already speaks Supabase (`auth.js`), it's a tiny additive table (additive, reversible),
> and "admin-manageable" maps cleanly to an admin-only write policy. Shopify **metaobjects**
> are the alternative and would keep all merchandising in Shopify admin (where the catalogue
> already lives), but the planner would need a new Storefront metaobjects query and the
> Storefront API's metaobject read permissions confirmed — more moving parts for launch.
> **Ruling: Supabase table, placeholder palettes seeded, RLS on.** This is a **schema/data
> decision → H applies the additive SQL** when DIY-3 is scheduled (AGENTS.md, Law P/Q). No
> planner admin-CRUD UI is built for v1 — palettes are edited out-of-band (Supabase Studio).

---



## Step 5 — NZBC checker (G3/AS1 clearances)

Extend `auto-design-rules.js` `NZ_BUILDING_RULES` (today it carries hob/gas/ventilation/
water figures and only the solver's hob-window check uses it) with **NZBC G3 (Food
preparation & prevention of contamination) / AS1** kitchen clearances:

```js
// ADDITIVE keys on NZ_BUILDING_RULES — DIY Step 5 checker (values pending installer review)
clear_space_operational_side_mm: 800,   // min clear floor space on a cabinet/appliance's operational side
clear_space_oven_door_open_mm:   600,   // min clearance in front of an oven with its door open
food_storage_min_provision:      true,  // layout must include pantry/food-storage + refrigeration space
// _meta.lastReviewed stays null until a licensed installer signs off (see Auto-Design Task 4.4)
```

`checkNzbcClearances(walls, placedItems, NZ_BUILDING_RULES)` emits warnings like:

```js
{ severity: 'warn',
  message:  'Less than 800mm clear space in front of the sink run (NZBC G3/AS1) — values pending installer review',
  wallIndex: 1,
  ruleId:   'clear_space_operational_side_mm' }
```

Notes:

- **Advisory, not blocking** for v1 — Finish is never disabled by these (contrast
Auto-Design, where `severity:'error'` blocks Generate). DIY warnings are teaching aids.
- **Values are indicative and flagged** `pending installer review` until the same licensed
installer who signs off Auto-Design's NZBC values (Auto-Design Part 5 Decision #3 / Task
4.4) confirms them. The 800mm / 600mm figures are the commonly cited NZ kitchen clearances
but **must be installer-verified before any "compliant" claim** (Law M — verify external
standards before asserting). Reuse Auto-Design's disclaimer copy pattern.
- The checker is a **pure function** in the already-pure rules module — unit-testable,
no Three.js/DOM.

---



## Part 4 — Risk Register


| Risk                                                               | Prob.  | Impact | Mitigation                                                                                 |
| ------------------------------------------------------------------ | ------ | ------ | ------------------------------------------------------------------------------------------ |
| Chassis reuse tempts a refactor of shipped `auto-design-wizard.js` | Medium | Medium | Decision #1: sibling file, no fork; consolidation is a separate roadmap task               |
| Mood-board storage picked without owner input                      | Low    | Medium | Decision #3 is a hard owner-ruling gate; default documented but flagged                    |
| NZBC clearance values wrong / stated as compliant                  | Medium | High   | Ship flagged "pending installer review"; advisory-only; same installer gate as Auto-Design |
| DIY room-replace wipes undo stack (`clearScene`)                   | Medium | Medium | Reuse `detachSceneForReplace()` or require empty scene for v1; never `clearScene()`        |
| DIY + Auto-Design collide on shared modal DOM/state                | Low    | Medium | Option b2: separate `#diy-modal` with prefixed IDs; null-safe init                         |
| Scope creep into Steps 3–5 before Steps 1–2 ship                   | Medium | Medium | Board authorises DIY-2 (Steps 1–2) only; each later phase is its own gated brief           |
| Touch UX regressions in the wizard                                 | Medium | Low    | Reuse the already-touch-tested `.ad-*` chassis; device QA each phase                       |
| DIY writes to `scene_json` and breaks the reader                   | Low    | High   | Explicit invariant (§1.5): DIY adds **no** `scene_json` keys, no version bump              |


**Out of scope (future roadmap, not this track):** Free Draw **multi-storey** kitchens;
auto-recolouring placed cabinets from a palette; a planner-side admin CRUD UI for mood
boards; per-user DIY flag. Noted so nobody builds them under the DIY banner without a fresh
spec.

---



## Part 5 — Decisions (some are open owner rulings)


| #   | Question                              | Decision / Recommendation                                                                                                                                                                                                                                                         | Rationale                                                                                                                  |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reuse strategy for the wizard chassis | **Sibling** `diy-wizard.js`**, reuse shell +** `.ad-`* **CSS + a11y; do NOT fork/refactor** `auto-design-wizard.js`**.** Consolidation into `wizard-core.js` is a later roadmap item                                                                                              | Honours "add, don't refactor"; keeps shipped Auto-Design untouched; small duplication                                      |
| 2   | NZBC value authority                  | **Ship G3/AS1 values flagged** `pending installer review`**; advisory-only; ride the same licensed-installer gate as Auto-Design (its Decision #3 / Task 4.4)**                                                                                                                   | One installer sign-off covers both features; no compliance claim until verified (Law M)                                    |
| 3   | Mood-board storage                    | **RULED (H, 24 Jul 2026): Supabase** `mood_boards` **table, RLS on, read-only in planner, placeholder palettes seeded.** Names/colours are placeholders, admin-editable later. H applies the additive SQL when DIY-3 is scheduled (schema decision — Law P/Q). Shopify metaobjects rejected. | Planner already speaks Supabase; tiny additive, reversible; metaobjects add a new Storefront query + permission to confirm |
| 4   | DIY build order                       | **Steps 1–2 first (DIY-2); Steps 3–5 each a later gated brief**                                                                                                                                                                                                                   | Board authorises Steps 1–2 only; walking-skeleton first (Law I)                                                            |
| 5   | Does DIY change `scene_json`?         | **No.** DIY output is ordinary walls/openings/items; round-trips through existing v3 serialise/load with no version bump                                                                                                                                                          | Keeps DIY off the persisted-shape risk surface (contrast S5)                                                               |
| 6   | Palette application in v1             | **Advisory only** — guides/pre-sorts product choices; does not auto-recolour placed cabinets                                                                                                                                                                                      | Smallest useful slice; auto-recolour is additive later                                                                     |
| 7   | Gate mechanism                        | **Reuse the Auto-Design hybrid gate pattern verbatim** (`?diy=1`, `DIY_DEFAULT`, `DIY_ADMIN_ROLES`, `window.DIY_ENABLED`, `window.DIY_KILL`)                                                                                                                                      | One proven, kill-switchable rollout mechanism                                                                              |


---



## Part 6 — Your sign-off (before we write any DIY code)

> **Recorded by A on H's instruction, 24 Jul 2026.** DIY mode is a big feature, so nothing
> gets built until the owner is happy with the plan and the business questions are answered.
> All boxes below are confirmed.

- [x] **You approve this plan overall** — including that the first version builds **only
      Steps 1 and 2** (set up the room, then add doors/windows/power points). Steps 3–5
      (colour schemes, guided cabinet placement, compliance check) come later, each as its
      own approved piece. Building in small slices keeps it safe and shows progress early.
- [x] **Where the colour schemes are stored: our own database.** These are the looks a
      customer picks from, and you'll add more over time. They live in our own database
      (Supabase), which is the quickest to launch and lets you edit the looks in one admin
      place. (The alternative — storing them inside Shopify — was not chosen.) Switching this
      on is a small one-time setup only you, as account owner, can do, when Step 3 is built.
- [x] **The four colour schemes are placeholders for now.** The names and colours in the
      Step 3 table are examples only; the admin user will replace and edit them later. Nothing
      is locked in.
- [x] **Compliance-check caveat understood.** Step 5 will *warn* customers if their layout
      looks tight against NZ kitchen guidelines (e.g. needing ~800mm clear space to work in).
      These are **helpful guidance, not a compliance guarantee** — we show a clear disclaimer,
      and a licensed installer confirms the exact numbers before we ever call a design
      "compliant" (the same installer sign-off already planned for Auto-Design).
- [x] **Devices for testing available** — iPhone, iPad, and a computer, so each step is
      checked by touch and mouse before it's called done.

**What happens next:** O writes the first job sheet — **DIY-2 (Steps 1 and 2)** — and the
builder implements it as one reviewable unit, checked by the reviewer and audited by A.
Everything after that (Steps 3–5) is approved by you the same way, one slice at a time,
before it's built.

---



## Post-build smoke checklist reference

Each DIY build brief ends by running the **AGENTS.md post-task smoke checklist** (desktop +
touch): Save Project & Restart Planner · long-press select on touch · cabinets sit on the
300mm slab (place, save, reload) · power point button in elevation · Quote CSV + PDF export ·
door/window select + drag along wall with dims · undo/redo · zoom speed normal with a
cabinet selected. DIY specifically must not regress opening/GPO tools (it drives them) or
undo/redo (every DIY action is individually undoable).