# Auto-Design Magic Button — Architecture & Execution Plan (v2.2)

**Project:** Brown Box Kit Kitchen Planner — Auto-Design Module
**Target:** NZ residential kitchen market
**Timeline:** 4–5 weeks calendar, ~30–35 hrs Cursor runtime, ~8 hrs architect time
**Status:** Rewritten after code-verified review of `main.js` (~6,000 lines). Supersedes v1.

**v2.1 amendments (review feedback, accepted):** feature flag + rollback policy for
Phase 3 (trap-proof launch switch); `manuallyModified` promoted from task detail to
§1.7 invariant; merge-not-rebase branch policy (§1.8); installer escalation gate at
Phase 2→3 boundary; GC comment in Task 3.3; disclaimer variants given homes (Task 4.2b);
analytics retention policy (Task 5.1); new Task 5.4 weekly telemetry review ritual.

**v2.2 amendments (second review round, accepted):** installer escalation paths named
in Decision #3 + research brief added to Task 0.5; Task 4.3 grep results must be a
reviewable table; §1.8 post-merge invariant re-validation; feature-flag flip test in
Task 3.2; per-user flag noted as Phase 5+ backlog.

**What changed from v1 (summary):**

1. `userData.parentWall` removed from provenance — `syncOpeningsTo3D()` deletes any
   placed item whose `userData.parentWall` matches a wall. Replaced with serialisable
   `autoWall: { specHash, wallIndex }`.
2. Replace flow no longer calls `clearScene()` (which wipes the undo stack and disposes
   meshes). New non-disposing `detachSceneForReplace()` + single `auto-design-replace`
   history entry. Replacing a kitchen is now undoable.
3. Batched undo now calls `clearWallOpeningMeshes()` per wall — `syncOpeningsTo3D()`
   creates door/window meshes that v1's undo entry would have orphaned.
4. `loadProductModel()`'s async mesh-swap patches only `add-item` history entries.
   The patch loop must be extended for all new batched entry types, or undo breaks
   after GLB models finish loading.
5. Stale-reference redo machinery (specHash re-resolution) deleted — redo re-adds the
   **same mesh objects**, matching the existing `add-wall-batch` pattern. No stale refs.
6. Wizard UI moved out of `main.js` into `auto-design-wizard.js`. `main.js` is already
   past the v1 plan's own 5,000-line extraction threshold, and Phase-1 roadmap work
   (wall UX, toasts, PDF quote) is editing `main.js` concurrently. Auto-design's
   footprint in `main.js` is ~200 lines of orchestration.
7. `loadScene()` restore path pollutes the undo stack (`placeProduct` pushes history per
   item; `MAX_HISTORY` is 20 — one generated kitchen blows it on load). Fixed via
   optional `skipHistory` param in Task 3.4.
8. Part 5 open questions are now **decided** (Part 5 below).
9. Cloud-agent priorities reordered: test catalogue JSON + save fixtures outrank the
   competitive teardown — they directly de-risk Phase 1 and Task 3.4.

---

## Part 1 — System Architecture

### 1.1 Module boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER (single SPA)                        │
│                                                                      │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │   main.js        │  │ auto-design-wizard  │  │  Auth + Persist │ │
│  │   (existing)     │◄─┤   .js (new)         │  │   (auth.js)     │ │
│  │  • Three.js      │  │  • 4-step modal DOM │  │  • Supabase     │ │
│  │  • Walls/items   │  │  • Spec state owner │  │  • Save/load    │ │
│  │  • Undo/redo     │  │  • Validation       │  │  • Schema v2    │ │
│  │  • Touch/desktop │  │  • Calls solver for │  └─────────────────┘ │
│  │  • ~200 new lines│  │    Step-4 preview   │                      │
│  │    orchestration │  └──────────┬──────────┘                      │
│  └────────▲─────────┘             │ onGenerate(spec, result)        │
│           │                       ▼                                 │
│           │            ┌──────────────────────┐                     │
│           │            │ auto-design-adapter  │  ◄── only file      │
│           └────────────┤      .js (new)       │      allowed to     │
│                        │  • Solver ↔ Scene    │      bridge solver  │
│                        │  • Provenance stamp  │      and scene      │
│                        │  • Batched undoEntry │                     │
│                        └──────────┬───────────┘                     │
│                                   ▼                                 │
│                        ┌──────────────────────┐                     │
│                        │  auto-design.js      │  ◄── pure module    │
│                        │  (new, no DOM/3D)    │      unit-testable  │
│                        │  • runAutoDesign()   │                     │
│                        │  • Archetype walls   │                     │
│                        │  • Cabinet sequencer │                     │
│                        └──────────┬───────────┘                     │
│                                   ▼                                 │
│                        ┌──────────────────────┐                     │
│                        │ auto-design-rules.js │  ◄── data + helpers │
│                        │  • Combo A rules     │                     │
│                        │  • Gap-fill ladder   │                     │
│                        │  • Fridge sizing     │                     │
│                        │  • NZ_BUILDING_RULES │                     │
│                        └──────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                  ┌────────────────────────────────┐
                  │  Shopify Storefront API        │
                  │  (existing — product catalogue)│
                  └────────────────────────────────┘
```

Four new files. `index.html` gains the `#auto-design-modal` markup and toolbar button.

### 1.2 Hard architectural rules

| Rule | Why |
|---|---|
| `auto-design.js` and `auto-design-rules.js` import nothing from Three.js, DOM, or `main.js` | Pure modules stay unit-testable |
| All solver I/O uses plain `{ x, y, z }` objects, never `THREE.Vector3` | JSON-serialisable; survives `JSON.stringify` round-trip |
| `auto-design-adapter.js` is the only file that writes scene state from solver output | Single chokepoint; easy to mock |
| `auto-design-wizard.js` owns spec state + modal DOM; never touches `scene`, `walls`, `placedItems` | Wizard is replaceable; `main.js` merge-conflict surface stays small |
| `main.js` imports adapter + wizard; never imports the solver directly | `main.js` stays ignorant of solver internals |
| **NEVER** set `userData.parentWall` on auto-generated cabinets | `syncOpeningsTo3D()` deletes any placed item with `userData.parentWall === wallObj` — it's the door/window ownership marker. Use `userData.autoWall = { specHash, wallIndex }` instead |
| Every new history entry type that stores mesh references must be added to `loadProductModel()`'s history-patch loop | The async GLB swap replaces placeholder meshes; unpatched entries hold stale references |
| Undo/redo for batched entries re-adds the **same mesh objects** — never recreate, never dispose on undo | Matches existing `add-wall-batch` pattern; keeps later `move-item` entries valid |
| Replace flow uses `detachSceneForReplace()` (no dispose, no history wipe), never `clearScene()` | `clearScene()` disposes geometry and clears both stacks — replacing a kitchen must stay undoable |
| Schema version bumps require a migration in `loadScene()` | Save files from any version must load |

### 1.3 Data flow — one generation cycle

```
User taps 🪄 Auto-Design (toolbar button)
   ↓
openAutoDesignWizard()                 wizard module resets spec to defaults
   ↓
[Step 1: size + archetype]        ──► spec.archetype, spec.widthMm, spec.depthMm
[Step 2: openings]                ──► spec.wallAssignments[].openings
[Step 3: appliance chips]         ──► spec.wallAssignments[].appliances
[Step 4: preview]                 ──► runAutoDesign(spec, products)
   ↓                                   returns { walls, cabinets, warnings }
User taps Generate                 ──► wizard calls ctx.onGenerate(spec, result)
   ↓
main.js: generateAutoDesignKitchen(spec, result)
   ├─ scene not empty? confirm → detachSceneForReplace()   (no dispose, no history wipe)
   ├─ applyAutoDesignResult(result, spec, ctx)             adapter layer
   │    ├─ buildWall() × N            (skipHistory=true)
   │    ├─ syncOpeningsTo3D() per wall
   │    ├─ placeProductAt() × M       provenance stamped at creation
   │    └─ returns { builtWalls, placedMeshes, skippedCabinets }
   ├─ pushHistory({ type:'auto-design-replace', data:{ removed*, builtWalls, placedMeshes, spec } })
   ├─ window.lastAutoDesignSpec = {...spec}
   └─ rebuildAllCaps / refreshAll2DLabels / rebuild2DWallOverlays / updateRoomArea / updateQuote
   ↓
Toast warnings, close wizard
```

### 1.4 Schema evolution

| Version | Adds | Migration |
|---|---|---|
| v1 (current) | `walls`, `items`, `camera`, `settings` | — |
| v2 (Phase 3) | `kitchenSpec` (last wizard input), `autoGenerated`/`kitchenRole`/`provenance` per item | **Lenient:** v1 loads as v2 with `kitchenSpec: null`, items treated as `{ source: 'manual' }` |
| v3 (deferred) | Template library, override events log; align with roadmap 2.11 per-wall thickness and 2.12 multi-room when those land | Forward-compatible — v2 files load as v3 with empty additions |

Provenance is kept in saved projects, **stripped from shared/exported artifacts**
(share links — roadmap 1.9, PDF quote — roadmap 1.3, CSV export).

### 1.5 State ownership

| State | Lives in | Touched by |
|---|---|---|
| `walls`, `placedItems` | `main.js` module scope (`let`, reassigned via `filter` — never hold long-lived references outside `main.js`) | adapter (via ctx closures only), undo/redo, save/load |
| `autoDesignSpec`, `autoDesignStep` | `auto-design-wizard.js` module scope | wizard only |
| `window.lastAutoDesignSpec` | global (intentional) | save/load, Regenerate |
| Wizard DOM | `index.html` `#auto-design-modal` | wizard module only |
| Solver result | transient — never stored | adapter consumes, discards |

### 1.6 Provenance schema

```js
mesh.userData = {
  product: { ... },              // existing
  skuIndex: 0,                   // existing
  autoGenerated: true,           // NEW
  kitchenRole: 'sink',           // NEW: corner|sink|hob|dishwasher|drawers|bin|fridge|filler|pantry
  manuallyModified: false,       // NEW: set true on move/rotate/sku-change/duplicate after generation
  autoWall: {                    // NEW: replaces v1's parentWall mesh reference
    specHash: 'a3f9c2',          //      serialisable, no circular refs,
    wallIndex: 1                 //      no collision with syncOpeningsTo3D()
  },
  provenance: {                  // NEW
    source: 'rules',             // 'rules' | 'manual' | 'ml-v1' (future)
    confidence: 1.0,
    reference: 'combo-a',
    generatedAt: '2026-06-10T...',
    specHash: 'a3f9c2'           // djb2(JSON.stringify(spec))
  }
};
```

### 1.7 Known integration traps (verified against current code)

Every Cursor session in Phase 3+ must be given this table.

| # | Trap | Consequence if ignored | Defence |
|---|---|---|---|
| 1 | `syncOpeningsTo3D(wallObj)` deletes every placed item with `userData.parentWall === wallObj` | User edits an opening in elevation view → all auto-generated cabinets on that wall silently deleted | Never set `parentWall` on cabinets; use `autoWall` (§1.6) |
| 2 | `clearScene()` disposes geometry AND wipes `undoStack`/`redoStack` | Undo after replace leaves an empty scene; old kitchen unrecoverable | `detachSceneForReplace()` — remove from scene, keep references in history entry, no dispose |
| 3 | `syncOpeningsTo3D()` pushes door/window meshes into `placedItems` | Undo of generation orphans opening meshes in the scene | Undo handler calls `clearWallOpeningMeshes(w)` per wall |
| 4 | `loadProductModel()` async-swaps placeholder mesh → GLB and patches **only** `add-item` history entries | Undo after GLB load operates on stale placeholders; GLB models stay in scene | Extend the patch loop for `auto-design-replace` and `delete-item-batch` (Task 3.2) |
| 5 | `placeProduct()` calls `pushHistory` internally; `loadScene()` uses it per item; `MAX_HISTORY = 20` | Loading a 20-cabinet generated kitchen overflows the history with junk entries | Optional `skipHistory` param on `placeProduct` (Task 3.4) |
| 6 | `serialiseScene()` skips items whose SKU has no `variantId` | Generating against the mock test catalogue then saving silently drops cabinets | Known + accepted in dev; Task 3.4 test plan asserts a console warning |
| 7 | `walls`/`placedItems` are reassigned (`placedItems = placedItems.filter(...)`) throughout | Long-lived array references outside `main.js` go stale | Adapter receives `pushWall`/`pushItem` closures, never stores the arrays |
| 8 | **Invariant:** any non-auto-design code path that mutates a placed item (move, rotate, SKU change, duplicate — present *or added by future roadmap work*) must set `userData.manuallyModified = true` on auto-generated meshes | "Clear auto-generated only" (Task 4.3) deletes cabinets the user has customised; override telemetry (Phase 5) under-counts edits | Rule, not a list — enumerated paths go stale as the roadmap adds features. Cite this row in any PR that touches item mutation |

### 1.8 Concurrency with the main roadmap

Phase-1 roadmap tasks (1.4 wall UX, 1.5 toasts, 1.3 PDF quote) edit `main.js` in
parallel with this feature. Rules of engagement:

- Auto-design work happens on `feature/auto-design`. At each phase boundary, **before**
  the phase's QA pass, **merge `main` into the feature branch** (`git merge main`) —
  never rebase. Merge keeps both histories intact and a bad merge is trivially abandoned
  (`git merge --abort`); a botched rebase mid-Phase-3 is not.
- Before every merge: `git tag pre-merge-phase-N` so rollback is one command.
- Merges and conflict resolution are **architect/human-only — never delegated to a
  Cursor agent.** Agents are bad at conflict resolution, and the worst time to learn
  that is mid-Phase-3.
- **After every merge from `main`, re-validate the §1.7 invariants before the phase QA
  pass** — in particular, re-grep for `placedItems` mutation sites (trap #8). A merge
  can succeed with zero conflicts and still silently break an invariant, e.g. roadmap
  1.4 adding a new mutation path that doesn't set `manuallyModified`. 30 seconds of
  grep catches it.
- Auto-design's `main.js` footprint is intentionally small (~200 lines, one section
  under a `// ── Auto-Design ──` header) to minimise merge conflicts.
- If roadmap work changes `buildWall`, `placeProduct`, history entry shapes, or
  `serialiseScene`/`loadScene` while this feature is in flight, re-run the Task 3.5
  regression matrix before merging either branch.
- Roadmap 1.8 (analytics) and this plan's Task 2.2/5.1 must converge on one
  `trackEvent()` implementation — whichever lands first owns it.

---

## Part 2 — Phase Plan

| Phase | Calendar | Cursor hrs | Architect hrs | Outcome |
|---|---|---|---|---|
| 0 — Pre-flight | Days 1–2 | 1 | 2 | Coupling map, NZBC + assets kicked off, fixtures ordered |
| 1 — Solver module | Days 3–7 | 6 | 1 | Pure solver passes 12 test cases in browser |
| 2 — Wizard UI | Days 8–12 | 8 | 1 | 4-step modal in own module, logs solver output, touch-ready |
| 3 — Scene integration | Days 13–20 | 9 | 2 | Magic button generates real walls + cabinets; undo/redo incl. replace; save/load v2 |
| 4 — Polish | Days 21–27 | 8 | 1 | Glide entry, warnings drawer, NZBC disclaimer, regenerate/clear |
| 5 — Telemetry & templates | Post-launch | 5 | 1 | Override dashboard, save spec as template |

Phase 3 gets one extra day vs v1 (integration traps #2/#4 need explicit tests).
Critical path: Phase 3 → 4. Phases 0–2 can overlap. NZBC installer review runs async.

**Checkpoint discipline:** commit + push at the end of every task; mandatory checkpoint
immediately before Tasks 3.2 and 4.1 (the two riskiest integrations).

**Phase 2 → 3 boundary gate:** if the licensed installer (Decision #3) is still
unidentified at this point, **escalate before starting Phase 3.** Their 1–2 week review
clock must start at Phase 4 *kickoff*, not Phase 4 end — starting it late delays launch
by exactly that long.

---

## Part 3 — Task Breakdown

### Phase 0 — Pre-flight (Days 1–2)

#### Task 0.1 — Ratify decisions
**Owner:** 🏛️ Architect — **Effort:** 15 min
Part 5 decisions are pre-made in this doc. Read, veto or sign off. Copy the table
into `SCHEMA_VERSIONING.md` at repo root for the record.

#### Task 0.2 — Inventory implicit coupling in `main.js`
**Owner:** ⚙️ Cursor — **Effort:** 1 hr
Prompt:

```
Audit main.js (read-only, do NOT modify any code). Produce MAIN_JS_COUPLING.md at repo
root containing 5 markdown tables:
1. Every module-scoped let/const that mutates scene state: name, initial value, mutating functions.
2. Every function called from 3+ call sites: name, signature, call sites.
3. Every undo/redo entry type: type string, data shape, executeUndo branch, executeRedo branch.
4. Every userData field used on meshes: field name, where set, where read.
   Flag explicitly: parentWall (set in syncOpeningsTo3D, read as deletion marker).
5. All async boundaries (Shopify fetch, GLB load via loadProductModel incl. its
   history-patch loop, Supabase calls).
Do not propose changes. Output the file only.
```

#### Task 0.3 — Git baseline
**Owner:** 👤 You — **Effort:** 5 min

```bash
git checkout -b feature/auto-design
git commit --allow-empty -m "Phase 0 baseline — auto-design feature branch"
```

#### Task 0.4 — NZBC source verification (async; blocks Task 4.4 sign-off, not its code)
**Owner:** ☁️ Cloud Agent + 👤 Human review — **Effort:** 2 hr cloud + 30 min review
**Expectation:** AS/NZS standards full texts are paywalled. The agent will return
indicative values with secondary-source citations. That is acceptable **because the
licensed installer review (Task 4.4b) is the authoritative gate** — rule values ship
flagged `lastReviewed: null` until then.
Brief:

```
Research and cite sources for NZ kitchen Building Code values. Return NZBC_KITCHEN_RULES.md:
- Hob clearance above (mm); hob clearance to side walls (mm); hob to combustible material (mm)
- Sink waste maximum horizontal run from trap (mm)
- Worktop standard height range (mm); range hood minimum duct diameter (mm)
- Hob-to-window minimum distance (mm); dishwasher plumbing connection radius (mm)
Consult: AS/NZS 5601.1 (gas), NZBC G4 (ventilation), NZBC G12 (water). Cite clause
numbers where accessible; where the primary text is paywalled, cite the best secondary
source and mark the value "indicative — installer review required". Where two standards
conflict, note which is more restrictive.
Format: [Value | mm | Source | Clause | URL | Confidence | Last reviewed date].
```

#### Task 0.5 — Kick off parallel cloud agents
**Owner:** 👤 You — **Effort:** 5 min each to brief; ~6 hrs async
Priority order (changed from v1 — fixtures outrank the teardown):

1. **Test catalogue JSON** — 15 mock SKUs matching the Shopify product shape
   (`id`/handle, `name`, `width/height/depth` mm, `skus[{label, price, variantId}]`,
   `category`, `modelPath: null`). Must include `b3-900-crnr` corner SKU and one
   deliberately missing SKU for Test 10. Unblocks all of Phase 1.
2. **Save/load fixtures** — 5 sample `scene_json` files at version 1 (hand-built from
   the `serialiseScene()` shape). Required by Task 3.4's regression test.
3. **Archetype SVG thumbnails** — 6 files (I, II, L, C, G, Custom), dark bg `#1e1e1e`,
   accent `#ff9500`, 80×80.
4. **Cabinet role icons** — 8 SVGs (sink, hob, dishwasher, drawers, bin, fridge,
   pantry, corner), 24×24, white stroke.
5. **Competitive teardown** — IKEA Home Planner, Kaboodle, Roomle, Houzz Pro NZ
   availability + pricing + feature matrix. Nice-to-have; drop first if budget is tight.
6. **Installer escalation research** — 30 min: candidate licensed installers /
   kitchen-industry consultants / NKBA NZ members who do paid compliance reviews, plus
   the MPGD NZ referral process. Feeds Decision #3's escalation paths; costs nothing
   if the primary installer comes through.

---

### Phase 1 — Solver Module (Days 3–7)

#### Task 1.1 — Build solver, rules, test harness
**Owner:** ⚙️ Cursor (fresh session) — **Effort:** 4–6 hrs
Prompt: existing Stage 1 brief verbatim, plus:

```
ADDITIONAL CONSTRAINTS:
- All Vector-like outputs MUST be { x, y, z } plain objects, never THREE.Vector3.
  Test harness asserts JSON.parse(JSON.stringify(result)) deep-equals result for every test.
- Export hashSpec(spec) from auto-design.js: djb2 of JSON.stringify(spec), 6-char hex.
- Catalogue lookups case-insensitive on productHandle.
- Solver completes < 50ms for the largest case (Test 4: G-shape) via performance.now();
  timing printed in test output.
- Use the mock catalogue from /fixtures/test-catalogue.json (cloud agent deliverable;
  if absent, inline a copy and note it for replacement).
```

**Done when:** all 8 original tests + JSON round-trip + timing pass in Chrome and Safari.

#### Task 1.2 — Extended edge-case tests
**Owner:** ⚙️ Cursor — **Effort:** 1 hr
Prompt:

```
Extend auto-design.test.html with 4 tests. Do not modify auto-design.js or
auto-design-rules.js — only the harness:
- Test 9: empty wallAssignments → { walls:[], cabinets:[], warnings:[{severity:'error',
  message:/no walls assigned/i}] }, no throw
- Test 10: catalogue missing b3-900-crnr → substitution warning + closest-width corner placed
- Test 11: two windows on sink wall → sink centred on first window with sill < 900mm
- Test 12: door + window overlapping zones → collision warning, best-effort layout completes
```

**Done when:** all 12 tests green.

#### Task 1.3 — Architect review
**Owner:** 🏛️ Architect — **Effort:** 30 min
Checklist: solver < 600 lines, rules < 300; zero Three.js/DOM refs; all outputs
JSON-serialisable; timing < 50ms.

---

### Phase 2 — Wizard UI (Days 8–12)

#### Task 2.1 — Build 4-step wizard module
**Owner:** ⚙️ Cursor (fresh session) — **Effort:** 5–7 hrs
Prompt: existing Stage 2 brief verbatim, plus:

```
STRUCTURAL CHANGE FROM ORIGINAL BRIEF:
All wizard JS lives in a new file auto-design-wizard.js (ES module), NOT in main.js.
Public API:
  export function initAutoDesignWizard(ctx)
    // ctx: { runAutoDesign, products: () => products, trackEvent,
    //        onGenerate(spec, result) }   ← main.js provides; wizard never touches scene
  export function openAutoDesignWizard(prefillSpec = null, startStep = 1)
  export function closeAutoDesignWizard()
The modal markup goes in index.html (#auto-design-modal); element IDs are the contract.
main.js: import + initAutoDesignWizard(ctx) + toolbar button → openAutoDesignWizard().

ADDITIONAL CONSTRAINTS:
- All interactive elements: min 44×44px hit target.
- Lock body scroll while open (class on <body> setting overflow:hidden) — iOS Safari.
- Test viewports: 1024×768 (iPad landscape), 820×1180 (iPad portrait), 1440×900 (desktop).
  Respect existing breakpoints (430px / 768px); no new ones.
- Step 1 archetype cards use /assets/archetype-*.svg (placeholder text if absent).
- Step 3 appliance chips use /assets/role-*.svg (emoji stub if absent).
- Escape closes modal AND resets spec to defaults.
- Modal traps focus (tab cycles inside).
- Step 4 calls ctx.runAutoDesign(spec, ctx.products()) and renders the preview;
  Generate calls ctx.onGenerate(spec, result). If products() is empty (Shopify still
  loading), show "Catalogue loading…" and disable Generate — no crash.
```

**Done when:** 4 steps navigate cleanly on iPad + desktop; Step 4 logs solver output;
`main.js` diff is < 40 lines.

#### Task 2.2 — Wizard funnel analytics stub
**Owner:** ⚙️ Cursor (same session) — **Effort:** 1 hr
Prompt:

```
Add to main.js (coordinate with roadmap task 1.8 — if a trackEvent already exists, use it):
function trackEvent(name, props = {}) {
  console.log('[track]', name, props);
  // Phase 5: persist to Supabase analytics_events
}
Pass into wizard ctx. Wizard fires: wizard_opened; wizard_step_advanced {from,to};
wizard_step_back {from,to}; wizard_validation_blocked {step,reason};
wizard_cancelled {atStep}; wizard_generated {archetype,widthMm,depthMm,bedrooms,
cabinetCount,warningCount,durationMs}; wizard_spec_changed {field,value} (debounced 500ms).
No network yet.
```

#### Task 2.3 — Real-device QA pass
**Owner:** 👤 You — **Effort:** 30 min — iPad Safari, iPhone Safari, desktop Chrome.
Checklist: 4 steps navigate without layout breakage; touch targets comfortable;
validation visible without scrolling; closes cleanly on Escape/Cancel/backdrop.

---

### Phase 3 — Scene Integration (Days 13–20) ⚠️ Critical path

> Checkpoint (commit + push) before starting Task 3.2.
> Every Cursor session in this phase gets §1.7 (integration traps) pasted into context.

#### Task 3.1 — Build adapter layer
**Owner:** ⚙️ Cursor (fresh session) — **Effort:** 2 hrs
Prompt:

```
Create auto-design-adapter.js — the ONLY file bridging the pure solver and the scene.
It imports nothing from main.js; main.js imports from it.

export function applyAutoDesignResult(result, spec, ctx) {
  // ctx: { THREE, buildWall, placeProductAt, syncOpeningsTo3D,
  //        pushWall(w), pushItem(m),       // closures — NEVER store ctx.walls/placedItems
  //        products, mm }
  // Returns: { builtWalls, placedMeshes, skippedCabinets }
}
export function hashSpec(spec) { /* djb2 of JSON.stringify(spec), 6-char hex —
  re-export from auto-design.js, single implementation */ }

Behaviour:
1. Each result.walls entry → ctx.buildWall(start, end, true) (skipHistory). Tag
   wallObj.isCabinetWall = true and wallObj.archetypeIndex.
2. Each spec.wallAssignments[i] with openings → set wallObj.openings then
   ctx.syncOpeningsTo3D(wallObj).
3. Each result.cabinets entry:
   a. Find product in ctx.products, case-insensitive productHandle match.
   b. Not found → push { cabinet, reason:'sku-not-found' } to skippedCabinets, continue.
   c. mesh = ctx.placeProductAt(product, position, rotationY)
   d. Stamp mesh.userData: autoGenerated:true, kitchenRole, manuallyModified:false,
      autoWall:{ specHash:hashSpec(spec), wallIndex }, provenance:{ source:'rules',
      confidence:1.0, reference:'combo-a', generatedAt:new Date().toISOString(),
      specHash:hashSpec(spec) }.
      ⚠️ NEVER set userData.parentWall — syncOpeningsTo3D() deletes any placed item
      whose parentWall matches a wall. parentWall is reserved for door/window meshes.
4. Do NOT call pushHistory, updateQuote, refreshLabels, or rebuildCaps — main.js
   orchestrates after the call.
JSDoc on all exports.
```

#### Task 3.2 — Wire Generate: orchestration, replace flow, placeProductAt
**Owner:** ⚙️ Cursor (same session) — **Effort:** 3.5 hrs
Prompt:

```
In main.js add a // ── Auto-Design ── section (keep ALL auto-design code in this one
section to minimise merge conflicts with parallel work).

1. placeProductAt — placement without history (adapter and loadScene use it):
function placeProductAt(product, position, rotationY) {
  const w = mm(product.width), h = mm(product.height), d = mm(product.depth);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x8B7355 })
  );
  mesh.position.set(position.x, position.y > 0 ? position.y : h / 2, position.z);
  // NOTE: `> 0` not `||` — solver emits y:0 meaning floor-seated; fallback must not fire.
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.userData = { product, skuIndex: 0 };
  scene.add(mesh);
  placedItems.push(mesh);
  if (product.modelPath) loadProductModel(product, mesh);
  return mesh;
}

2. detachSceneForReplace — like clearScene but undoable:
   - Remove all wall meshes/caps/labels from scene; clearWallOpeningMeshes(w) per wall.
   - Remove all placed item meshes from scene.
   - DO NOT dispose anything. DO NOT touch undoStack/redoStack.
   - walls = []; placedItems = []; then the usual label/overlay group clears,
     hideWallPopup(), updateRoomArea(), updateQuote().
   - Return { removedWalls, removedMeshes } (the original objects, by reference).

3. generateAutoDesignKitchen(spec, result) — passed to wizard ctx as onGenerate:
   - const hasContent = walls.length > 0 || placedItems.length > 0;
   - If hasContent: confirm('Replace current kitchen with auto-designed layout?
     You can undo this.') — on cancel, trackEvent + return.
   - const detached = hasContent ? detachSceneForReplace()
                                 : { removedWalls: [], removedMeshes: [] };
   - Build ctx (closures for pushWall/pushItem; never pass raw arrays).
   - const { builtWalls, placedMeshes, skippedCabinets } =
       applyAutoDesignResult(result, spec, ctx);
   - pushHistory({ type:'auto-design-replace', data:{
       removedWalls: detached.removedWalls, removedMeshes: detached.removedMeshes,
       builtWalls, placedMeshes, spec: {...spec} } });
   - Non-info warnings → showImportToast(msg, severity==='error');
     skippedCabinets.length → toast '<n> cabinets skipped (SKU not found)'.
   - window.lastAutoDesignSpec = {...spec};
   - rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); updateRoomArea();
     updateQuote(); closeAutoDesignWizard();
   - trackEvent('wizard_generated', {...}); showImportToast('Kitchen generated ✓');

4. ⚠️ CRITICAL — extend loadProductModel()'s history-patch loop (currently patches only
   entry.type === 'add-item'). Add:
   - 'auto-design-replace': swap placeholderMesh → model inside data.placedMeshes
     and data.removedMeshes arrays.
   - 'delete-item-batch' (added Phase 4): swap inside data.meshes.
   Without this, undo after GLB models finish loading operates on stale placeholders.

5. Feature flag (kill switch + rollback path):
   window.AUTO_DESIGN_ENABLED = true;   // top of the Auto-Design section
   The toolbar button (and Phase 4's tools menu) render only when true. Flipping it to
   false hides the entire feature without touching any other code — this is the
   rollback plan if Phase 3 sign-off fails, and the kill switch after launch.
   VERIFY at sign-off: flip to false in DevTools → toolbar button and tools menu
   disappear; flip back to true → they return. The kill switch must be proven to work
   in the same session that wires it — document the test result in the task sign-off.
```

#### Task 3.3 — Undo/redo for `auto-design-replace`
**Owner:** ⚙️ Cursor (same session) — **Effort:** 1 hr
Prompt:

```
Add 'auto-design-replace' branches to executeUndo/executeRedo. Model on the existing
'resize-wall' (removed/restored arrays) and 'add-wall-batch' branches.

executeUndo:
  - Remove data.builtWalls from scene (mesh, capMeshes, label2D,
    clearWallOpeningMeshes(w)); walls = walls.filter(...).
  - Remove data.placedMeshes from scene; placedItems = placedItems.filter(...).
  - Re-add data.removedWalls (scene.add, push to walls,
    syncOpeningsTo3D(w) if w.openings?.length).
  - Re-add data.removedMeshes (scene.add, push to placedItems) — SKIP meshes whose
    userData.type is 'door'/'window' (recreated by syncOpeningsTo3D above).
  - rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea(); updateQuote();
executeRedo: exact mirror.

Rules:
- Re-add the SAME mesh objects. Never recreate, never dispose, no reference
  re-resolution — later move-item entries must stay valid.
- Mirror handling of label2D / capMeshes / opening meshes from existing branches.
- Add this comment above the 'auto-design-replace' branch:
  // NOTE: this entry intentionally holds live references to every removed/placed mesh
  // for the lifetime of its history slot. When the slot ages out of MAX_HISTORY the
  // references drop and GC collects them. Do NOT "optimise" the mesh arrays away —
  // undo/redo depends on re-adding these exact objects.

Manual edge-case verification:
1. Generate kitchen → move ONE cabinet → Ctrl+Z (only move undoes) → Ctrl+Z (whole
   generation undoes, previous scene returns) → Ctrl+Y ×2 (kitchen returns, cabinet
   at post-move position).
2. Generate with GLB-modelled products → WAIT for models to load → undo → redo.
   Verifies the loadProductModel patch loop from Task 3.2.
3. Generate over an existing drawn room → undo → original room intact, openings render.
```

#### Task 3.4 — Schema v2 save/load
**Owner:** ⚙️ Cursor (same session) — **Effort:** 2 hrs
Prompt:

```
1. placeProduct(product, skipHistory = false) — additive optional param; when true,
   skip the pushHistory call. All existing call sites unchanged.
2. loadScene(): use placeProduct(product, true) in the restore path — loading a scene
   must not pollute the undo stack (MAX_HISTORY is 20; a generated kitchen has 15+ items).
3. serialiseScene():
   - version: 2
   - kitchenSpec: window.lastAutoDesignSpec || null
   - per item, if mesh.userData.autoGenerated: include autoGenerated:true, kitchenRole,
     autoWall, provenance (all plain JSON — autoWall is {specHash,wallIndex}, never a
     mesh/wall reference).
   - When an auto-generated item is skipped for missing variantId, console.warn with
     the kitchenRole (mock-catalogue dev safety).
4. loadScene():
   - Accept version 1 OR 2; reject others (keep existing console.warn).
   - v2: restore window.lastAutoDesignSpec from kitchenSpec; restore the userData
     fields after each placeProduct call.
   - v1: lenient — treat as v2 with kitchenSpec:null, no provenance.

Manual tests (fixtures from /fixtures/, cloud agent deliverable):
1. Generate L-shape → save → reload page → load → positions correct AND
   console.log(placedItems[0].userData.provenance) intact.
2. Load each v1 fixture → loads clean, items have userData.provenance === undefined.
3. After any load: undoStack.length === 0.
```

#### Task 3.5 — Architect review + regression matrix
**Owner:** 🏛️ Architect + 👤 Human QA — **Effort:** 1 hr review + 1.5 hr testing

- [ ] Generate I-shape → undo → redo → save → reload → load
- [ ] Generate L-shape with sink+hob+DW+fridge → sequence matches Combo A
- [ ] Generate over existing drawn room → confirm → undo → **original room returns intact**
- [ ] Generate, move cabinet, undo, undo, redo, redo (Task 3.3 case 1)
- [ ] Generate with GLB products, wait for load, undo, redo (Task 3.3 case 2)
- [ ] Generate, delete one auto cabinet, save, reload → only kept cabinets restore
- [ ] Generate twice in one session → second confirms replace; history clean; undo steps back through both
- [ ] Open wizard while Shopify products loading → "Catalogue loading…", no crash
- [ ] Generate, then draw a wall manually → coexist, no interference
- [ ] **Edit an opening in elevation view on a generated wall → cabinets on that wall survive** (trap #1)
- [ ] Load any v1 fixture → clean load

---

### Phase 4 — Polish (Days 21–27)

> Checkpoint before Task 4.1.

#### Task 4.1 — Glide drawing → wizard handoff
**Owner:** ⚙️ Cursor (fresh session) — **Effort:** 2 hrs
Prompt:

```
Step 1 "Use Glide Drawing" card: close modal, set window.glideForAutoDesign = true,
call startGlideDraw().
In commitGlideDraw(), after builtWalls populated and the add-wall-batch entry is pushed:
if (window.glideForAutoDesign) {
  window.glideForAutoDesign = false;
  openAutoDesignWizard({
    archetype: detectArchetypeFromWalls(builtWalls),
    wallAssignments: builtWalls.map((w, i) => ({
      wallIndex: i, appliances: [], hasFridge: false, isCornerWall: null,
      openings: w.openings || []
    }))
  }, 2);  // prefill + jump to Step 2
}
Detection helpers (walls have THREE.Vector3 start/end — distanceTo available):
  detectArchetypeFromWalls: 1→'I'; 2→parallel?'II':'L'; 3→'C';
  4→hasShortLeg?'G':'custom'; else 'custom'
  areWallsParallel: atan2 angle diff < 0.05 rad (or π±0.05)
  hasShortLeg: any length < 0.5 × max length
Note: glide walls already created their own add-wall-batch history entry. The wizard's
later Generate will detach those walls into the auto-design-replace entry — verify
undo ordering: undo generation → glide walls return; undo again → glide walls gone.
```

#### Task 4.2a — Warnings drawer in Step 4
**Owner:** ⚙️ Cursor (same session) — **Effort:** 2 hrs
Prompt: as v1 — grouped collapsible drawer (errors red/expanded/block Generate;
warnings yellow/collapsed; info blue/collapsed); per-item severity icon + message;
`wallIndex` → "→ wall" link highlights wall mesh `#ff9500` for 2s; errors disable
Generate with tooltip; "Continue anyway" only for warnings. Lives in
`auto-design-wizard.js`; wall-highlight goes through a `ctx.highlightWall(i)` callback.

#### Task 4.2b — NZBC disclaimer copy
**Owner:** ☁️ Cloud Agent — **Effort:** 30 min
2 length variants, NZ tone, informative not alarmist, referencing Task 0.4 sources.
Every variant has a home — no dead deliverables:
- **30 words** → wizard Step 4, above the Generate button (rendered in Task 4.4)
- **60 words** → PDF quote footer (consumed by roadmap task 1.3 when it lands)
(12-word variant dropped from v1 brief — it had nowhere to render.)

#### Task 4.3 — Clear + Regenerate utility buttons
**Owner:** ⚙️ Cursor (same session) — **Effort:** 2 hrs
Prompt:

```
"Auto-design tools" section (toolbar dropdown or Quote panel section):
1. "🔄 Regenerate with current spec" — disabled if window.lastAutoDesignSpec is null;
   opens wizard prefilled from it at Step 4; Generate confirms replacement as usual.
2. "🗑 Clear auto-generated only" — disabled if no placedItems with
   userData.autoGenerated && !userData.manuallyModified. On confirm:
     const toRemove = placedItems.filter(m =>
       m.userData.autoGenerated && !m.userData.manuallyModified);
     pushHistory({ type:'delete-item-batch', data:{ meshes: toRemove } });
     toRemove.forEach(m => scene.remove(m));
     placedItems = placedItems.filter(m => !toRemove.includes(m));
     updateQuote();
   Add executeUndo/executeRedo branches for 'delete-item-batch' (same-reference re-add,
   no dispose). Confirm loadProductModel's patch loop covers this type (Task 3.2 step 4).
3. Enforce §1.7 trap #8 (invariant, not a list): ANY code path that mutates a placed
   item must set userData.manuallyModified = true on auto-generated meshes. Currently
   that means desktop move/rotate/sku-change AND the touch overlay's
   drag/rotate/duplicate — but grep for every placedItems mutation site and cover them
   all. A duplicate of an auto-generated mesh copies userData but gets
   manuallyModified:true and autoGenerated:false.
   COMPLETENESS PROOF REQUIRED: output a markdown table of EVERY grep hit with columns
   [file:line | mutation kind | action taken: flag-added / already-correct / not-a-
   mutation (why)]. "I grepped and fixed the obvious ones" does not close this task —
   the architect reviews the table before Task 4.3 sign-off.
```

#### Task 4.4 — NZBC rules + disclaimer integration
**Owner:** ⚙️ Cursor + 👤 licensed installer (external clock) — **Effort:** 2 hrs code + 1–2 wks review
Prompt:

```
In auto-design-rules.js:
export const NZ_BUILDING_RULES = {
  hob_clearance_above_mm: 600, hob_clearance_side_mm: 50,
  hob_combustible_distance_mm: 200, sink_waste_max_horizontal_mm: 3000,
  worktop_height_range_mm: [850, 950], dishwasher_plumbing_radius_mm: 1500,
  range_hood_min_duct_mm: 150, hob_window_min_distance_mm: 300,
  _meta: {
    sources: ['AS/NZS 5601.1', 'NZBC G4', 'NZBC G12'],
    lastReviewed: null,             // stays null until installer sign-off
    reviewedBy: null,
    disclaimer: 'Guidance only. Confirm with a licensed installer and your local council before purchase or installation.'
  }
};
Solver emits severity:'warn' per rule breach:
  { severity:'warn', message:'Hob within 300mm of window (NZBC G4)', wallIndex: i,
    ruleId:'hob_window_min_distance_mm' }
While _meta.lastReviewed is null, append ' — values pending installer review' to each
NZBC warning message.
Wizard Step 4 renders the 30-word disclaimer variant (Task 4.2b) above Generate.
```

#### Task 4.5 — Polish QA pass
**Owner:** 👤 You — **Effort:** 1 hr
Glide entry (incl. undo ordering), warnings drawer, regenerate flow, clear-auto
preserves manual + modified cabinets, disclaimer renders, full Task 3.5 matrix re-run
after merging `main` into the feature branch (§1.8 — tag first, architect-only).

---

### Phase 5 — Post-launch (Week 5+)

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 5.1 Wire analytics to Supabase | ⚙️ Cursor | 2 hrs | `analytics_events` table, **RLS on** (insert: authenticated, scoped to `auth.uid()`), batch flush every 10 events / 30s; converge with roadmap 1.8. **Retention policy (conscious choice, NZ Privacy Act 2020): indefinite for v1, revisit at 6 months** — record in the table's SQL comment |
| 5.2 Override telemetry dashboard | 🏛️ + ☁️ | 4 hrs | Cloud drafts SQL: per kitchenRole, % moved/deleted/SKU-swapped within 1 session, grouped by specHash archetype; architect wires one Supabase Studio view |
| 5.3 Save spec as template | ⚙️ Cursor | 3 hrs | `templates` table (RLS), "Save as template" on Step 4, "Start from template" on Step 1 |
| 5.4 Telemetry review ritual | 👤 You | 30 min/wk | **Calendar item, not code.** Weekly for the first 8 weeks post-launch, then monthly. Each review outputs one paragraph in `OVERRIDE_LEARNINGS.md`: what users overrode, which rule to adjust. Without this habit the dashboard is a Supabase bill, not product feedback — the entire ML-moat thesis depends on it being read |

**Phase 5+ backlog (noted, not scheduled):** per-user feature flag via a Supabase
`user_flags` table, if a partial rollback ever becomes necessary — the global
`AUTO_DESIGN_ENABLED` kill switch is all-or-nothing by design for v1.

---

## Part 4 — Risk Register

| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Phase 3 surfaces an undo/redo edge case beyond the four known traps | Medium (was High — traps #1–#4 now designed out) | Medium | §1.7 in every session's context; Task 3.5 matrix; 1 buffer day budgeted |
| Installer review returns "your numbers are wrong" | Medium | High | Review runs parallel to Phase 4; values flagged "pending review" in-product until sign-off |
| Merge conflicts with parallel Phase-1 roadmap work in `main.js` | Medium | Medium | Single `// ── Auto-Design ──` section; wizard in own file; merge `main` in at phase boundaries (tag first, architect-only — §1.8) |
| Phase 3 sign-off fails the Task 3.5 gate | Medium | Medium | **Default response: ship behind the feature flag** (`window.AUTO_DESIGN_ENABLED = false`, Task 3.2 step 5) and fix in the next sprint — Phase 4 polish stays demo-able. Fix-forward only for single-cause failures; revert-to-Phase-2 is the last resort |
| Wizard touch UX needs iteration | High | Low | Task 2.3 device QA before Phase 3; 2 hr fix window |
| Glide archetype detection misclassifies hand-drawn rooms | Medium | Low | Wizard Step 1 lets the user correct the archetype; detection is a default, not a gate |
| Solver > 50ms on G-shape | Low | Low | Task 1.1 perf assertion |
| Save file from v1 fails post-Phase-3 | Low (was Medium — fixtures now mandatory) | High | Task 3.4 v1-fixture test gates Phase 3 sign-off |
| Override telemetry shows solver is genuinely bad | Low | High | Phase 5 dashboard surfaces within 2 weeks; rules editable in one file |
| `main.js` keeps growing from parallel work | Accepted | Medium | Auto-design adds ~200 lines; further extraction is a roadmap decision, not this feature's |

---

## Part 5 — Decisions (formerly open questions)

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Schema v2 migration policy | **Lenient** — v1 auto-loads as v2 | Zero user-facing breakage; trivial defaulting |
| 2 | Wizard placement | **Toolbar button only for v1**; empty-scene onboarding card deferred to backlog | Smallest UI surface; card is additive later |
| 3 | NZBC review owner | **OPEN — needs a name + turnaround before Phase 4 starts.** Escalation paths if no installer identified by the Phase 2→3 gate: (a) Master Plumbers, Gasfitters & Drainlayers NZ referral (owns AS/NZS 5601.1 territory), (b) paid review via a kitchen-industry consultant or NKBA NZ member (cloud agent researching candidates — Task 0.5 #6), (c) ship with warnings flagged "pending installer review" — already the Task 4.4 default, zero extra work | Only remaining human dependency |
| 4 | Auto-generated visual distinction | **Identical to manual** | Provenance is data, not decoration |
| 5 | Provenance privacy | **Keep in saves; strip from share links, PDF, CSV** | `generatedAt` is per-user behaviour; saves are RLS-scoped, exports are not |
| 6 | Regenerate vs side-by-side | **Confirm-then-replace** — now undoable via `auto-design-replace`, which removes most of the downside | Side-by-side deferred |
| 7 | Wizard code location (new) | **`auto-design-wizard.js`, separate module** | `main.js` already past the 5,000-line threshold v1 set; parallel roadmap work makes a small `main.js` diff the priority |

---

## Part 6 — Sign-off Checklist

- [ ] Architect has read and approved this document (esp. §1.7 traps and Part 5 decisions)
- [ ] Decision #3 answered: licensed installer named, turnaround estimated
      (hard escalation gate at Phase 2→3 boundary if still open — see Part 2)
- [ ] Calendar items created: phase-boundary merges, Phase 2→3 installer gate,
      Task 5.4 weekly telemetry reviews
- [ ] Cloud agents briefed in Task 0.5 priority order (fixtures first)
- [ ] `feature/auto-design` branch created (Task 0.3)
- [ ] iPad + iPhone + desktop available for QA checkpoints between phases
- [ ] Parallel-roadmap owners aware of §1.8 rules of engagement

Once green, Phase 0 starts and the calendar clock begins.
