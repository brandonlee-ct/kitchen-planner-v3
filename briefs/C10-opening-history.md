# S Brief — C10: door / window / power-point add + delete in undo/redo (and therefore autosave)

> **Author:** `O-opus-06oct26` — O, PM (Opus, subagent in H's local Cursor session, 6 Oct 2026).
> **History-entry shape: ruled by A, 6 Oct 2026** (`A-fable-06oct26`, relayed by H; recorded in
> RELAY.md 6 Oct entry (d)). `AGENTS.md` makes history-entry shape ask-first, so **this brief is the
> answer to that ask, and S must not deviate from the shape below without a new ruling.**
> **Solution design and this brief:** O. Written against `main` @ `c812c64`, read at file level.

## Delegation template (Law G — ROLES.md §O, verbatim fields)

```
Base: main, current and pulled (do NOT stack on unmerged work).
Read first: AGENTS.md + ROLES.md §S + this brief. State in one line which TASKS.md
  item this maps to.
Task (one deliverable): C10 — make adding and deleting a door / window / power point
  undoable and redoable via two NEW history types, add-opening and remove-opening, so
  every add/delete also triggers the draft autosave.
In scope: main.js only — pushHistory calls at the four add/delete sites listed in §3a
  (addOpening, elev-add-door, elev-add-window, elev-add-gpo, elev-delete-opening), and two
  new branches each in executeUndo and executeRedo, plus at most one small shared helper
  for the post-undo/redo refresh.
Out of scope / do NOT touch: index.html, style.css, auth.js; the shape or handling of
  EVERY existing history type, explicitly including edit-opening; pushHistory /
  applyUndo / applyRedo / MAX_HISTORY / scheduleDraftAutosave themselves; scene_json /
  serialiseScene / loadScene (openings already serialise); syncOpeningsTo3D internals;
  opening edits made in the elevation panel (drag / Apply / Centre / green dims — a
  separate gap, see §6); the wall-popup and elevation button markup.
Definition of Done: runs end-to-end, one demoable function, exercised in the target
  role/context/device, "how to test" note included, build passes.
Stop and ask before: schema/RLS/data-migration changes, shared or cross-system
  contract changes, new secrets/vendors, architecture/auth/security decisions,
  anything contradicting the docs.
Output: one small reviewable unit off main, then stop.
```

**Board item:** `TASKS.md` → 🔴 Bug brief **`C10`**. Register row 12.

**Brief-specific stop-and-ask:** stop if you find any **other** code path that adds or removes an
opening (§3a lists every one O found), or if the payload below turns out to be insufficient to
reverse an operation. A shape change needs a new A ruling, not an S judgement call.

---

## 1. The problem (verified by O at file level, 6 Oct)

Openings live in `wallObj.openings` as plain objects
`{ type: 'door'|'window'|'gpo', width, height, distFromLeft, floorDist }` (mm). They are rendered
into 3D by `syncOpeningsTo3D(wallObj)`, which disposes and rebuilds that wall's opening meshes.

Every **add** and **delete** path mutates `wallObj.openings` and calls `syncOpeningsTo3D` **without
`pushHistory`**. That has two consequences:

1. **Undo is broken for openings.** Ctrl+Z after adding a door skips past it to an earlier action
   (an `AGENTS.md` "never break undo/redo" violation).
2. **Data loss.** The draft autosave is scheduled **only** from `pushHistory`
   (`pushHistory` → `scheduleDraftAutosave()`). A customer who draws a room, adds a door and closes
   the tab loses the door unless some other mutating action happened afterwards.

Pushing history at those sites fixes both, with no change to autosave code.

## 2. The ruling (A, 6 Oct 2026) and O's application of it

**A's ruling:** **ADDITIVE ONLY.** Two new types, **`add-opening`** and **`remove-opening`**. **NO
change** to any existing entry shape or to `edit-opening`. The payload carries enough to reverse
fully: a wall reference (what `edit-opening` uses), a **full clone** of the opening, and its
**index** in `wall.openings`, following `edit-opening`'s convention.

**What `edit-opening` uses** (`executeUndo` / `executeRedo`, and the two push sites `endOpeningDrag`
and the 3D opening dim editor):

```
{ type: 'edit-opening', data: { wallObj, op, before, after } }
undo: Object.assign(entry.data.op, entry.data.before); if (walls.includes(entry.data.wallObj)) syncOpeningsTo3D(entry.data.wallObj);
```

`wallObj` is a **live** wall reference and `op` is a **live** reference to the opening object.

**The payload — exact fields (both types identical):**

```
{ type: 'add-opening' | 'remove-opening',
  data: {
    wallObj,          // live wall reference — same as edit-opening.data.wallObj
    op,               // live reference to the opening object — same as edit-opening.data.op
    snapshot,         // { ...op } — A's "full clone", taken at push time
    index             // position of op in wallObj.openings at push time (remove: BEFORE removal)
  } }
```

**Why both `op` and `snapshot` (O's application, flagged to A for confirmation in RELAY 6 Oct (d)):**
earlier `edit-opening` entries for the same opening hold the **same object** in `data.op`. If
undoing a delete reinserted a *clone*, those older entries would edit an orphan object. Undo would
then appear to do nothing while the scene quietly diverged. So the handlers **reinsert the live `op`**.
`snapshot` is carried exactly as A ruled. Its use is limited to the one place where it is safe (below).
⚠ If A rules the clone must be the only object reference, **stop**; this brief changes first.

## 3. Design

### 3a. Push sites — every add/delete path O found (there is no 3D-side opening delete)

| Path | Where | Push (after the mutation, before/after `syncOpeningsTo3D` — either) |
|---|---|---|
| Wall popup `＋ Door` / `＋ Window` / `＋ GPO` (`wp-door`, `wp-window`, `wp-gpo`) | all three call **`addOpening(wallObj, type)`** | inside `addOpening`, after `wallObj.openings.push(op)`: `index = wallObj.openings.length - 1`. One push site covers all three buttons. `addOpening`'s signature and return value are unchanged |
| Elevation `＋ Door` | `elev-add-door` handler | after `elevWall.openings = elevOpenings`: `wallObj = elevWall`, `index = elevWall.openings.indexOf(op)` |
| Elevation `＋ Window` | `elev-add-window` handler | same |
| Elevation `＋ Power Point` | `elev-add-gpo` handler | same |
| Elevation `Delete` | `elev-delete-opening` handler | capture `op = elevSelectedItem` and `index = elevWall.openings.indexOf(op)` **before** the filter; push after `elevWall.openings = elevOpenings` |

Payload at each site: `{ wallObj, op, snapshot: { ...op }, index }`. Do **not** change the existing
order of statements in those handlers beyond inserting the push. Do not add `skipHistory` parameters.

### 3b. `executeUndo` / `executeRedo` — four new branches

Guard first, exactly like `edit-opening`: **if `!walls.includes(wallObj)`, do nothing.** The wall
may have been replaced by `resize-wall`, which rebuilds openings as `{ ...op }` copies on new wall
objects, or deleted. That is the established, accepted limitation of `edit-opening`, and C10 inherits
it rather than inventing a new rule.

- **undo `add-opening`** and **redo `remove-opening`** → *remove `op` from the wall:*
  `const i = wallObj.openings.indexOf(op); if (i !== -1) wallObj.openings.splice(i, 1);`
  Remove by **identity**, never by index alone; the index is a hint for reinsertion only.
- **redo `add-opening`** and **undo `remove-opening`** → *put `op` back:*
  if `wallObj.openings` is missing, create `[]`. If `op` is already present, do nothing (idempotent).
  Otherwise `wallObj.openings.splice(Math.min(Math.max(index, 0), wallObj.openings.length), 0, op)`.
  **Reinsert the live `op`, never the snapshot object.**
  - On **undo `remove-opening`** only, `Object.assign(op, snapshot)` is permitted. A removed opening
    is unreachable while removed, so this is a no-op in practice.
  - On **redo `add-opening`**, do **NOT** apply the snapshot. Elevation-panel edits (drag / Apply /
    Centre / green dims) mutate `op` **without** history (§6). Re-applying the push-time snapshot
    would silently revert such an edit that the user made before undoing the add.

Then the shared refresh, both directions (one small helper is fine):

1. `syncOpeningsTo3D(wallObj)`.
2. If the opening just **removed** is selected, clear the selection. That means
   `elevSelectedItem === op` → `clearElevSelection()`, and `opDim3D.sel && opDim3D.sel.op === op` →
   `clearOpening3DSelection()`. A selection pointing at a removed opening must not survive.
3. If the elevation panel is open on this wall (`elevWall === wallObj`): `elevOpenings =
   wallObj.openings` (the same alias the add/delete handlers already establish), then
   `drawElevation()`. Use the existing `typeof drawElevation === 'function'` guard style that
   `endOpeningDrag` uses. Verify that `clearElevSelection` / `drawElevation` / `clearOpening3DSelection`
   are reachable from `executeUndo` (they are declared at module level with legacy indentation, and
   `executeUndo` already calls `syncOpeningsTo3D`). If one is not reachable, stop and ask; do not
   move functions.

**Do not touch** `placedItems` directly. `syncOpeningsTo3D` already owns removing and disposing the
wall's opening meshes and rebuilding them (dispose pattern intact).

### 3c. What comes for free, and what must stay unchanged

- **Autosave:** each new `pushHistory` schedules the debounced draft autosave. No autosave code changes.
- **Redo stack:** `pushHistory` already clears it. Adding a door after an undo correctly discards redo.
- **`MAX_HISTORY` (20):** each add/delete now consumes one slot. That is intended.
- **Save/load:** openings already serialise via `wallObj.openings`; `scene_json` is unchanged and **no
  version bump**. The history stack clears on load as today.
- **Touch + mouse:** all five sites are button `click` handlers on the wall popup and elevation panel,
  and undo/redo is the same `btn-undo`/`btn-redo` + Ctrl+Z/Ctrl+Y path on both. Parity is structural,
  but **exercise both** (§5).
- **Null-safety:** no new top-level wiring is added. If you find yourself adding a listener, use the
  `const el = document.getElementById(...); if (el) …` pattern.

## 4. Definition of Done (brief-specific additions)

- Add → Undo removes the opening (3D, elevation, 2D); Redo restores the **same** opening at the same
  position in the list. Delete → Undo restores it; Redo deletes it again.
- **Chained with `edit-opening`:** add a door → drag it in 3D → delete it → Undo ×3 → Redo ×3 ends
  in exactly the state before the first Undo, and each step is visibly correct.
- Draft autosave fires after a lone add (§5 step 6).
- No existing history type behaves differently; the full undo/redo smoke still passes.
- `npm run build` passes; reviewer subagent run; "how to test" note included.
- `TASKS.md` `C10` → `- [ ] ⏳` on push/deploy, ✅ **only** after H live-verifies.

## 5. How to test (Law L — starts with getting the new code on screen)

1. **Get the build on screen.** In `C:\dev\kitchen-planner-v3`: `git fetch origin`, then
   `git checkout <S's branch or main after merge>`, then `git pull`, then `npm ci --include=optional`,
   then `npm run dev`. Open the printed URL (normally `http://localhost:5173/`). On a phone or iPad add
   `?debug=1` for the eruda console. **On the live site** (after H merges and Vercel deploys `main`),
   open `https://planner.brownboxkit.co.nz`.
2. **Wall popup add.** Draw a room (Preset Rectangle is fastest). Select a wall → `＋ Door`. Press
   **Ctrl+Z** (or the toolbar undo button, `btn-undo`). *Expect:* the door disappears. Redo (Ctrl+Y or
   `btn-redo`). *Expect:* it is back
   in the same place. Repeat with `＋ Window` and `＋ GPO`.
3. **Elevation add + delete.** Open the wall's elevation (the wall popup's elevation-view button, `wp-view`). `＋ Door`, then
   select it and press `Delete`. Undo. *Expect:* the door returns in both the elevation and 3D, and is
   not left selected in a broken state. Undo again. *Expect:* the door is gone (the add is undone).
   Redo ×2. *Expect:* added, then deleted.
4. **Chained with an edit.** In 3D, add a door, drag it along the wall, then delete it from the
   elevation. Undo three times, one at a time. *Expect:* restored at the dragged spot, then back to the
   original spot, then gone. Redo three times. *Expect:* the reverse.
5. **Selection safety.** Select a door in 3D (blue box and green dims), then undo its add. *Expect:* the
   blue box and dims disappear with it, and nothing is left floating.
6. **Autosave (the data-loss fix).** Restart Planner. Draw a room, add **one** door, do nothing else,
   wait 2 seconds, then reload the tab. *Expect:* "Resume your unsaved design?" → Restore → the door is
   there. (Before this fix the door was lost.)
7. **Save/load.** Save the project with openings, Restart Planner, load it. *Expect:* openings intact.
   Undo is empty after load, as before.
8. **Touch.** Repeat steps 2, 3 and 6 on an iPad/iPhone (or a 390px window with touch emulation), using
   the on-screen undo/redo buttons.
9. Run the full `AGENTS.md` post-task smoke checklist, desktop **and** touch, with special attention to
   "door/window select + drag along wall with dims", "power point button in elevation" and "undo/redo".

## 6. Known adjacent gap — NOT in this unit

Opening **edits** made in the elevation panel do not push history either: the elevation-canvas drag
release, `elev-apply` for an opening, `elev-center-opening`, and `applyGreenDimEdit` for openings
(its cabinet branch does push, via `writeCabinetTo3D`). Only the **3D** drag and the **3D** dim editor
push `edit-opening`. Fixing that would use the **existing** `edit-opening` shape, but it is a separate
unit. O has raised it with H/A in RELAY (6 Oct entry (d)). **Do not fix it here.** Do not make C10
depend on it either; §3b's "do not apply the snapshot on redo-add" rule exists precisely because of it.
