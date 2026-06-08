# Cloud Agent Brief — 1.2b Drawing UX Polish (autonomous overnight run)

> Paste this whole file as the task for a Cloud Agent. It is self-contained.
> Also read `AGENTS.md` and use the `reviewer` subagent before finishing.

## Execution model (IMPORTANT — read first)
- **Branch off the latest `main`** (it already contains Free Draw FD-1..5 and the Quick Draw
  camera-lock work — see "Do NOT touch" below). Work on a feature branch named
  `feat/1.2b-drawing-ux-polish`.
- Complete **all steps in a single autonomous run.** Do NOT wait for a human "done" between
  steps — there is nobody available to confirm.
- **After EACH step: commit AND push** that commit to your feature branch before starting the
  next step (e.g. `1.2b step 1: custom mm ceiling/thickness inputs`). Incremental pushes make
  progress crash-safe and let a human review the PR step by step.
- **Push only to your own feature branch — never to `main`.** Open ONE Pull Request titled
  "1.2b: Drawing UX polish" early (after step 1) and let the per-step pushes update it. Do not
  merge; a human reviews and merges.
- Do NOT paste full file contents in your messages — edit files in the repo directly; the
  reviewer reads the PR diff.
- **You cannot test on physical iPhone/iPad/Android.** Reason carefully + do desktop checks;
  leave a "Manual device testing required" checklist in the PR description (see Test Plan).

## Context
Brown Box Kit 3D kitchen planner (vanilla JS + three.js, no framework). The planner has
Quick Draw, Free Draw, Preset Room, Freehand, Two-Point, and Glide Draw modes. They work but
the Preset/Freehand flows and the wall popup need the polish below.
**ADD to existing functions; do not replace them.**

## Hard rules (from AGENTS.md)
- Do not refactor working code — add or patch only.
- Do not change function signatures.
- Do not break undo/redo, save/load, or auth.
- Touch AND mouse paths must both keep working.
- Measurements: internal **metres**, UI shows **mm** via the `mm()` helper.
- Dispose three.js geometry/materials/textures for any mesh you remove.

## ⛔ Do NOT touch (recently shipped — changing these will cause conflicts/regressions)
- **Quick Draw camera lock**: `mode === 'draw-wall'` sets `controls.enabled = false` while
  drawing and restores it in `cancelWallDraw()`. Leave the lock/restore and Quick Draw's
  existing 90° commit snap as-is.
- **Free Draw** (entire feature): `mode === 'draw-free'`, `startFreeDraw()`, `cancelFreeDraw()`,
  `freeDrawSnap()`, `snapToStartLine()`, `showStartAxisGuides()`, the `btn-free-draw` button,
  and the FD edit code (`fdSel`, `fdAnchor`, `fdSelectWall()`, `fdReplaceWall()`, `fdApplyLength()`,
  `fdEditEl`, the FD mousedown/mousemove/mouseup slide handlers). Do not modify or "improve" these.
- The `resize-wall` history entry shape `{ removed:[...], restored:[...] }` — reuse it if you
  need undoable wall edits; do not change its shape.

## Verified hooks you will use (already exist in main.js)
`previewWallPoints`, `drawPreviewPolygon()`, `clearPreview()`, `commitGlideDraw()`,
`weldCorners()`, `orthogonalisePoints()`, `lockRoom()`, `make2DLabel()`, `rebuildAllCaps()`,
`refreshAll2DLabels()`, `rebuild2DWallOverlays()`, `minorGrid`, `settings.ceilingHeight`,
`settings.wallThickness`, `settings.gridSize`, `wallPopup` (built via innerHTML; ids
`wp-height`, `wp-thickness`, `wp-type`, `wp-confirm`), `serialiseScene()`, `loadScene()`.
`floorMesh` does NOT exist yet — create it as a new global (Step 5).

## Steps

**Step 1 — Custom mm input for ceiling height + wall thickness.**
In `wallPopup`, ceiling height is a `<select>` of 2400/2700. Add a "Custom..." option that
reveals a number input (min 1000, max 5000 mm). Wall type/thickness: keep 110/150 presets, add
"Custom..." revealing a number input (min 50, max 500 mm). On Apply (`wp-confirm`), update
`settings.ceilingHeight` / `settings.wallThickness` and call `rebuildAllCaps()`. Custom values
must round-trip through `serialiseScene()` / `loadScene()` (they already save `settings`).

**Step 2 — Preset Room: lock pan + live dimensions + angles during preview.**
When `mode === 'draw-preset'` and `previewWallPoints.length > 0`:
- Disable OrbitControls pan, 2D pan, and pinch zoom (mirror how `draw-free` locks the camera).
- For each edge, render a midpoint dimension label (mm) using the `make2DLabel` canvas-texture
  pattern. For each corner, render the interior angle in degrees.
- Labels orange, always face camera, visible in 2D and 3D.
- Rebuild labels every time `drawPreviewPolygon()` runs; clear them in `clearPreview()`.

**Step 3 — Preset Room: drag a whole wall edge.**
In `mode === 'draw-preset'`, clicking/touching the MIDDLE of an edge (not a corner handle)
lets the user drag that edge perpendicular to its direction, moving both endpoint corners
together while preserving adjacent wall angles. Snap to grid. Live-update the Step 2 labels.

**Step 4 — Freehand/Glide weld bug fix.**
In `commitGlideDraw()`, straight runs sometimes commit as 2 segments. After `weldCorners()`
and `orthogonalisePoints()`, add a pass merging collinear consecutive segments: if A→B→C are
collinear (within ~3°) AND B is not a corner of another wall, drop B. Repeat until stable.
A perfect rectangle must commit as exactly 4 walls.

**Step 5 — Auto floor on closed room.**
When `lockRoom()` fires (closed loop exists), add a `THREE.Shape`-based floor covering the
interior: colour #3a3530, `MeshStandardMaterial`, inset from walls by half wall thickness.
Remove/rebuild when walls change (add/delete/resize/slide). Store in a new global `floorMesh`
and regenerate it inside `loadScene()` after walls are rebuilt (no new save field needed).

**Step 6 — Verify save/load + undo/redo still work.**
Walls, items, custom ceiling/thickness, and the auto floor must serialise/restore correctly.
Confirm undo/redo is intact for every new action you add.

**Step 7 (OPTIONAL, only if low-risk) — Parallel snap guide lines.**
Visual only: while previewing in Preset/Freehand, show a blue guide line when an edge is
parallel to an existing wall. Skip this step entirely if it risks the working draw paths.

## Test Plan (put as a checklist in the PR for a HUMAN to run on real devices)
- [ ] Wall popup → ceiling height "Custom" → 2550 → Apply → walls rebuild at 2550mm; save+reload keeps 2550.
- [ ] Wall popup → thickness "Custom" → e.g. 90 → Apply → caps rebuild correctly.
- [ ] Desktop + iPad: Preset Room → Rectangle → drag a corner shows live dims + angles → drag an edge moves both corners together → ✓ commits walls.
- [ ] Freehand/Glide on a rectangle → exactly 4 walls.
- [ ] Close a room any way → grey floor appears; delete/resize a wall → floor updates.
- [ ] Save project, reload → walls, items, floor, custom settings all restore.
- [ ] Undo/redo after each new action behaves correctly.
- [ ] Regression: Quick Draw camera stays locked while drawing; Free Draw select/resize/slide still work.
