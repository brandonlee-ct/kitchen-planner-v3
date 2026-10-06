# S Brief — C10: opening add/delete → undo/redo + autosave

> **Author:** `O-opus-06oct26` — O, PM (Opus, subagent in H's local Cursor session, 6 Oct 2026).
> **Problem:** found by the 1.19 post-task smoke run (19 Aug 2026), written on the `TASKS.md` `C10` line.
> **History-entry shape:** ruled by A on 6 Oct 2026 (`A-fable-06oct26`, relayed by H; recorded in
> `RELAY.md`, 6 Oct entry, part (d)). This was the `AGENTS.md` ask-first blocker. **Solution design
> and this brief:** O. Written against `main` @ `c812c64` (+ the 6 Oct docs commits), read at file level.

## ⚠ Build gate — read before starting

O's payload adds one field to A's ruling: a **live** `op` reference alongside A's clone (`snapshot`).
The reason is in §3a. That addition is flagged to A in `RELAY.md` (6 Oct entry, part (d)) and is
**not yet confirmed**. **S must not start until the `TASKS.md` `C10` line or a `RELAY.md` entry records
A's confirmation.** If A rules clone-only instead, O amends this brief first; S does not adapt it.

## Delegation template (Law G — ROLES.md §O, verbatim fields)

```
Base: main, current and pulled (do NOT stack on unmerged work).
Read first: AGENTS.md + ROLES.md §S + this brief. State in one line which TASKS.md
  item this maps to.
Task (one deliverable): C10 — adding a door / window / power point, and deleting one in the
  elevation panel, become undoable/redoable history entries, so they are also draft-autosaved.
In scope: main.js only —
  - two NEW history types, 'add-opening' and 'remove-opening', each with one branch in
    executeUndo and one in executeRedo;
  - one pushHistory call in addOpening (covers wp-door / wp-window / wp-gpo);
  - one pushHistory call in each of the elev-add-door / elev-add-window / elev-add-gpo handlers;
  - one pushHistory call in the elev-delete-opening handler;
  - at most two small new helpers (one to re-insert / remove an opening, one for the shared
    "refresh 3D + elevation" tail).
Out of scope / do NOT touch: index.html, style.css, auth.js; the 'edit-opening' entry, its
  push sites and its undo/redo branches; every other existing history type; pushHistory,
  applyUndo, applyRedo, MAX_HISTORY, scheduleDraftAutosave; serialiseScene / loadScene and
  the scene_json version (the opening record's shape does not change); syncOpeningsTo3D's
  body; addOpening's signature and return value; the elevation panel's drag / Apply / Centre
  / green-dim edit paths (see §6 — a separate gap, not this item); auto-design; Free Draw.
Definition of Done: runs end-to-end, one demoable function, exercised in the target
  role/context/device, "how to test" note included, build passes.
Stop and ask before: schema/RLS/data-migration changes, shared or cross-system
  contract changes, new secrets/vendors, architecture/auth/security decisions,
  anything contradicting the docs.
Output: one small reviewable unit off main, then stop.
```

**Board item:** `TASKS.md` → 🔴 Bug brief **`C10`**.

**Brief-specific stop-and-ask (in addition to the template):** stop if the work seems to need a
change to any existing history entry, to a function signature, to the opening record
(`{ type, width, height, distFromLeft, floorDist }`), or to `scene_json`. Also stop if `grep` finds
**any** code path that adds an opening to, or removes one from, `wall.openings` other than the
seven listed in §2. Do not wire an unlisted path on your own judgement.

---

## 1. The problem (verified by O at file level, 6 Oct)

Every add path and the elevation delete path mutate `wall.openings` and call `syncOpeningsTo3D`
**without `pushHistory`**. Two consequences:

1. **Undo skips the action.** Ctrl+Z after adding a door undoes whatever came before it. That breaks
   the `AGENTS.md` rule "never break undo/redo".
2. **Data loss.** The draft autosave is scheduled **only** from `pushHistory`
   (`pushHistory` → `scheduleDraftAutosave`, `main.js` ~line 320). A customer who draws a room, adds
   a door and closes the tab loses the door unless some other mutating action happened afterwards.

Routing these mutations through `pushHistory` fixes both. **No separate autosave call is needed or
wanted.**

## 2. The seven paths (all in `main.js`, as of `c812c64`)

| # | Trigger | Code today | Change |
|---|---|---|---|
| 1–3 | Wall popup `wp-door` / `wp-window` / `wp-gpo` (~line 2111) | `if (selectedWall) addOpening(selectedWall, type)` | none in the handlers — push inside `addOpening` (row 7) |
| 4 | Elevation `elev-add-door` (~3444) | `elevOpenings.push(op); elevWall.openings = elevOpenings; syncOpeningsTo3D(elevWall); selectElevItem(…); drawElevation();` | push `add-opening` after `elevWall.openings = elevOpenings` |
| 5 | Elevation `elev-add-window` (~3456) | same shape as #4 | same |
| 6 | Elevation `elev-add-gpo` (~3468) | same shape as #4 | same |
| 7 | `addOpening(wallObj, type)` (~3549) | `wallObj.openings.push(op); syncOpeningsTo3D(wallObj); return op;` | push `add-opening` after `syncOpeningsTo3D`, before `return op` |
| 8 | Elevation `elev-delete-opening` (~3420) | `elevOpenings = elevOpenings.filter(o => o !== elevSelectedItem); elevWall.openings = elevOpenings; clearElevSelection(); …` | capture `op` + `index` **before** the filter; push `remove-opening` after `elevWall.openings = elevOpenings` |

(Rows 1–3 and 7 are one path. `addOpening`'s only callers today are the three wall-popup buttons.
**Re-grep `addOpening(` before you start.** If another caller has appeared, stop and ask, because a
push inside `addOpening` would then add history to that caller too.)

Push **after** the mutation, so an early `return` can never leave a history entry for something
that did not happen.

## 3. History-entry design (A's 6 Oct ruling, applied)

```js
{ type: 'add-opening',    data: { wallObj, op, snapshot, index } }
{ type: 'remove-opening', data: { wallObj, op, snapshot, index } }
```

| Field | Value at push time | Why |
|---|---|---|
| `wallObj` | the **live wall object** (`selectedWall` / `elevWall` / `addOpening`'s `wallObj`) | The house convention. `add-wall`, `delete-wall`, `wall-height` and `edit-opening` all hold `data.wallObj` as a live reference. **No history entry stores a wall index**, and an index would be wrong here: undoing a wall deletion re-adds the wall with `walls.push`, so wall positions in `walls` are not stable. |
| `op` | the **live opening object** that is now in, or was just removed from, `wallObj.openings` | The `edit-opening` convention: `data.op` is a live reference, mutated with `Object.assign` on undo/redo. See §3a. |
| `snapshot` | `{ ...op }`, a full clone (A's ruling) | The opening record is flat (`type`, `width`, `height`, `distFromLeft`, `floorDist`), so a spread **is** a full clone. Restores the recorded values on re-insert. |
| `index` | `add-opening`: `wallObj.openings.length - 1` after the push. `remove-opening`: `elevOpenings.indexOf(op)` **before** the filter (the copy and the wall's array share order and objects, so the index is the wall's) | Re-inserts at the same position. Position affects nothing visible today, but this makes undo an exact inverse, as A ruled. |

### 3a. Why `op` is carried alongside A's clone (flagged to A — see the build gate)

`edit-opening` entries hold the **same object** as `data.op`. If undo-remove re-inserted the
*clone*, any older `edit-opening` entry for that opening would keep pointing at the original object,
which is no longer in `wall.openings`. A later undo of that edit would silently change an orphan, so
the user would press Undo and see nothing happen. Re-inserting the **original** object, with the
recorded values restored from `snapshot`, keeps every older entry valid. This is additive, and it
changes no existing shape.

### 3b. Undo / redo behaviour

| Entry | `executeUndo` | `executeRedo` |
|---|---|---|
| `add-opening` | **remove** `op` from `wallObj.openings` | **re-insert** `op` |
| `remove-opening` | **re-insert** `op` | **remove** `op` from `wallObj.openings` |

- **Remove:** by identity, not by index. `const i = wallObj.openings.indexOf(op); if (i !== -1) wallObj.openings.splice(i, 1);`
- **Re-insert:** `if (!wallObj.openings) wallObj.openings = [];` then, only if
  `!wallObj.openings.includes(op)`: `Object.assign(op, snapshot);` then
  `wallObj.openings.splice(Math.min(index, wallObj.openings.length), 0, op);`.
  The `includes` guard makes a double re-insert impossible. Restoring from `snapshot` matches
  `edit-opening`, whose undo restores recorded values and ignores any un-recorded change made since
  (see §6).
- Mutate `wallObj.openings` **in place** (`splice`). Do not replace the array.
- **Then the shared tail (both types, both directions):**
  1. `if (walls.includes(wallObj)) syncOpeningsTo3D(wallObj);`. This is the same guard `edit-opening` uses. Because history is LIFO the wall is normally present, but a guard costs nothing.
  2. **If the elevation panel is open on this wall** (`elevWall === wallObj`):
     - `elevOpenings = wallObj.openings;`. **This line is required, not tidy-up.** `openWallElevation`
       takes a **copy** (`elevOpenings = [...wallObj.openings]`), and the elevation add/delete
       handlers write that array back with `elevWall.openings = elevOpenings`. Without the re-alias,
       an undo made while the panel is open is reverted by the next elevation add. The undone door
       comes back, or the restored door is wiped. Re-aliasing is exactly what the elevation
       handlers already do after their first add/delete.
     - if `elevSelectedKind === 'opening'` and `!wallObj.openings.includes(elevSelectedItem)` →
       `clearElevSelection()`. That closes the editor for an opening that no longer exists.
     - `drawElevation();`
- **3D selection needs nothing.** `update3DOpeningDims` already clears the blue selection and green
  dims every frame when the selected opening is no longer in its wall's `openings`
  (`main.js` ~line 9375). Do not add a second clear.
- **Dispose:** `syncOpeningsTo3D` already disposes the opening meshes' geometry and material on every
  rebuild. Do not add disposal.
- **Memory:** each entry holds a wall reference and a small plain object until it ages out of
  `MAX_HISTORY` (20). `edit-opening` already does the same. No change.

## 4. Acceptance criteria

1. Each of the seven paths in §2 produces exactly **one** history entry per click. Ctrl+Z / `↶` undoes
   it, and Ctrl+Y / Ctrl+Shift+Z / `↷` redoes it.
2. After undo, the opening is gone from 3D, from the elevation drawing (if open) and from the saved
   or autosaved `scene_json`. After redo, it is back with the **same** type, size and position.
3. **Autosave:** adding or deleting an opening, with no other action afterwards, is in
   `localStorage['bbk_draft_autosave']` within about 1 s and survives a tab reload through the
   "Resume your unsaved design?" prompt.
4. **Edit chains still work:** add a door → drag it in 3D (`edit-opening`) → undo, undo → redo, redo.
   The door ends at its dragged position.
5. **Elevation stale-copy case:** with the elevation panel open, undoing an add, then adding another
   opening in the panel, does **not** bring back the undone opening.
6. `edit-opening` and every other existing history type behave exactly as before. No change to
   `scene_json` and no version bump. Saved projects from before this change load unchanged.
7. Touch and mouse both work. The add/delete buttons are the same DOM buttons on both, and `↶`/`↷`
   are the same toolbar buttons.

## 5. Definition of Done (brief-specific additions)

- All seven acceptance criteria hold, desktop **and** touch.
- `npm run build` passes, the reviewer subagent has run, and the "how to test" note is included.
- `TASKS.md` `C10` → `- [ ] ⏳` on push/deploy, and ✅ **only** after H live-verifies (board convention).
- Full `AGENTS.md` post-task smoke checklist, desktop **and** touch. Pay particular attention to
  "undo/redo", "door/window select + drag along wall with dims" and "power point button in elevation".

## 6. Explicitly NOT in this item (adjacent gap, raised separately)

Opening **edits** made inside the elevation panel also skip history today: the canvas drag
(`elevDragOp` release), the `elev-apply` button for an opening, `elev-center-opening`, and the
green-dim editor `applyGreenDimEdit` for openings. Only the **3D** drag (`endOpeningDrag`) and the
**3D** dim editor push `edit-opening`. That gap is recorded in `RELAY.md` (6 Oct entry, part (d)) for
H/A to decide whether it gets a board ID. **Do not fix it here.** One consequence to expect while
testing: an elevation drag between an add and its undo/redo is not recorded. Redo restores the door
to the size and position it was **added** with. That matches how `edit-opening` already treats
unrecorded changes, and it is not a C10 defect.

## 7. How to test (Law L — starts with getting the new code on screen)

1. **Get the build on screen.** In `C:\dev\kitchen-planner-v3`: `git fetch origin`, then
   `git checkout <S's branch, or main after H merges>`, then `git pull`, then
   `npm ci --include=optional` (on a fresh clone a plain `npm install` can omit jspdf's optional
   `canvg` and break the build), then `npm run dev`. Open the printed URL (normally
   `http://localhost:5173/`). Add `?debug=1` on a phone or iPad for the on-screen eruda console.
   **On the live site** (after H merges and Vercel deploys `main`), open
   `https://planner.brownboxkit.co.nz` instead. Hard-refresh first (Ctrl+Shift+R, or close and
   reopen the tab on iPad/iPhone) so you are not on a cached bundle.
2. **Wall popup — add, undo, redo (desktop).** Draw a room. Click a wall, then in its popup click
   **＋ Door**. *Expect:* a door appears. Press **Ctrl+Z**. *Expect:* only the door disappears, and
   the wall stays. Press **Ctrl+Y**. *Expect:* the door is back in the same place. Repeat with
   **＋ Window** and **＋ GPO**.
3. **Elevation — add, undo, redo.** Open the wall's elevation view. Click **＋ Window**. Press
   **Ctrl+Z** while the panel is still open. *Expect:* the window disappears from the elevation
   drawing **and** from 3D. **Ctrl+Y** brings it back in both.
4. **Elevation — delete, undo, redo.** In the elevation view, click a door, then **Delete**. Press
   **Ctrl+Z**. *Expect:* the door returns at the same width, height and position. **Ctrl+Y**
   removes it again.
5. **Stale-copy check (acceptance criterion 5).** Close the elevation panel. Add a door from the wall
   popup. Open that wall's elevation view. Press **Ctrl+Z** (the door disappears). Now click
   **＋ Power Point** in the panel. *Expect:* only the power point appears, and the undone door does
   **not** come back.
6. **Edit chain.** Add a door, then drag it along the wall in 3D. Press Ctrl+Z twice (the door goes
   back, then disappears). Press Ctrl+Y twice. *Expect:* the door reappears, then returns to its
   dragged position.
7. **Autosave — the data-loss case.** Restart Planner. Draw a room, add one door, and do nothing
   else. Wait 2 seconds. In DevTools → Console, run
   `JSON.parse(localStorage.getItem('bbk_draft_autosave'))` and expand `walls`. *Expect:* one wall
   has the door in `openings`. Reload the tab and choose **Restore** at "Resume your unsaved design?"
   *Expect:* the door is there.
8. **Save / load.** Save the project, Restart Planner, then load it. *Expect:* the openings are as
   saved. The undo stack starts empty after a load, as today.
9. **Touch (iPad / iPhone, or a 390px window with touch emulation).** Tap a wall, tap **＋ Door**,
   then tap the toolbar **↶**. *Expect:* the door disappears. Tap **↷**. *Expect:* it is back. Open
   the elevation view, tap **＋ Power Point**, close the panel, and tap **↶**. *Expect:* the power
   point disappears. If `↶` is reachable while the elevation panel is open on your device, also
   repeat step 3 with it.
10. Run the full `AGENTS.md` post-task smoke checklist, desktop **and** touch.
