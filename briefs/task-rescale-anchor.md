# Opus Brief — Parametric wall-length rescale + Select-mode anchor (Task B)

> This is a **design + architecture** task for Opus, not a quick patch. Two linked problems:
> (1) resizing a wall in a closed room distorts the other walls, and (2) the user can't choose
> which end of a wall moves when resizing in Select mode. Solve (1) first; (2) depends on it.
> Read `AGENTS.md` first. Output an agreed design, then implement on a feature branch.

## Context
Brown Box Kit 3D kitchen planner — vanilla JS + three.js, single file `main.js` (~5.8k lines).
Scene state lives in the `walls` array; each `wallObj` is
`{ mesh, start: Vector3, end: Vector3, capMeshes, label2D, baseColor, opacity, openings? }`.
Internal units are **metres**; UI shows **mm** (`mm()` helper). Closed rooms set `roomLocked = true`
and populate `roomCorners`.

## Problem 1 — resizing distorts the room (the real bug)
`resizeLockedWall(wallObj, newLengthM)` (in `main.js`):
- **Open chain**: rebuilds just the one wall — fine.
- **Closed room (`roomLocked`)**: extends `wallObj` along its current direction and then rebuilds
  the *next* wall (`walls[(idx+1) % walls.length]`) to keep the loop closed. Because it moves a
  shared corner along one wall's axis, the adjacent walls **rotate/slant** — right angles are lost.

Two root causes:
1. **Geometry**: keeping a loop closed while changing one edge's length *requires* moving more than
   one corner if you want to preserve 90° angles. The current code moves one corner only → slant.
2. **Array-order assumption (latent bug)**: `resizeLockedWall` finds the neighbour by
   `walls.indexOf(wallObj)` + `(idx+1) % walls.length`, i.e. it assumes the `walls` array is in
   loop/adjacency order. But `buildWall()` **appends** every new wall (including rebuilt ones), so
   after any resize/edit the array order no longer matches the physical loop. Subsequent resizes
   then pick the **wrong** neighbour → severe distortion.

### What to design
A **parametric rescale** that, when a wall length changes in a closed rectilinear room:
- Preserves all existing right angles (and ideally any non-90° angles) by moving the **opposite/
  adjacent walls** as needed, not by slanting neighbours.
- Works from a **topology** of the room (corner graph / ordered loop) rather than relying on
  `walls` array order. Decide whether to: (a) maintain an explicit ordered corner/edge model, or
  (b) derive adjacency on demand from shared corner positions (`cornerKey()` already exists).
- Defines behaviour for the common case (axis-aligned rectangle/L-shape) precisely; degrade
  gracefully for arbitrary polygons (document the limitation).
- Records **one** undoable entry reusing the existing `resize-wall` history shape
  `{ removed:[...], restored:[...] }` (do not change that shape).
- Preserves each wall's `baseColor` / `opacity` across the rebuild (a `carryWallStyle(src, dst)`
  helper already exists — use it), and its `openings`.

## Problem 2 — Task B: anchor control in Select mode (depends on Problem 1)
When a wall is selected in **Select mode** and the user edits its length in the Edit Wall popup,
they must be able to choose **which end stays fixed** (the anchor) so the opposite end moves.
- Free Draw already has this concept (`fdAnchor` = `'start' | 'end'`, the `wp-fd-anchor` button,
  `fdHandleColors()`). Task B brings the same control into **Select mode** (it is currently
  hidden outside Free Draw).
- The anchor choice must feed the Problem-1 rescale so the correct corner is held and the room
  stays square.
- UI lives in the existing `wallPopup` (ids are the contract — see `index.html` / `showWallPopup`).
  Reuse `wp-fd-anchor` styling/labels; do not rename existing ids on one side only.

## Hard rules (from AGENTS.md)
- Add to working code; do not refactor or change function signatures.
- Never break undo/redo or save/load. Touch AND mouse paths must keep working.
- Dispose three.js geometry/materials/textures for any mesh removed (`disposeModel()` /
  the cap-rebuild pattern).
- Ask before changing scene-state shape (`walls` / `scene_json`) or history-entry shape.

## ⛔ Do NOT touch
- Free Draw feature internals (`startFreeDraw`, `cancelFreeDraw`, `freeDrawSnap`, `fdReplaceWall`,
  `fdApplyLength`, the FD slide/anchor handlers) except to *read* `fdAnchor`'s pattern.
- Wall Style (Task D): `baseColor`/`opacity`, `applyWallVisual`, `wallBaseColor`, `carryWallStyle`,
  the right-click `wallStylePopup`.
- X-ray (Task E): `wallXray`, `XRAY_OPACITY`, `setWallXray`.

## Deliverables
1. A short written design (topology model + rescale algorithm + anchor UX) for human sign-off.
2. Implementation on branch `feat/rescale-anchor`, one PR, per-step commits, **never push to main**.
3. Test plan covering: rectangle + L-shape resize keeps 90°; repeated resizes don't drift
   (array-order bug gone); anchor start vs end both correct; undo/redo; save/reload; styled +
   transparent walls keep their look; openings survive.
