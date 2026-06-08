# Cloud Agent Brief — Task H: Drawing UX Overhaul (autonomous overnight run)

> Paste this whole file as the task for a Cloud Agent. It is self-contained.
> Also read `AGENTS.md` and use the `reviewer` subagent before finishing.

## Execution model (IMPORTANT — read first)
- Complete **all 9 steps in a single autonomous run.** Do NOT wait for a human "done"
  between steps — there is nobody available to confirm.
- Make **one git commit per step** (e.g. `Task H step 1: shift-lock 90° in Quick Draw`)
  so each step can be reviewed and reverted independently.
- Do NOT paste full file contents in your messages — edit files in the repo directly;
  the reviewer will read the PR diff.
- **You cannot test on physical iPhone/iPad/Android.** Do your best with code reasoning
  and desktop checks; leave a clear "Manual device testing required" checklist in the PR
  description (see Test Plan). Real-device testing is done by a human afterward.
- When all steps are done, run the `reviewer` subagent checklist, then open ONE Pull
  Request titled "Task H: Drawing UX overhaul" with a step-by-step summary.

## Context
Brown Box Kit 3D kitchen planner (vanilla JS + three.js, no framework). Task G complete.
The planner has Quick Draw, Preset Room, Freehand, Two-Point, and Glide Draw modes — they
work but need UX improvements. **ADD to existing functions; do not replace them.**

## Hard rules (from AGENTS.md)
- Do not refactor working code — add or patch only.
- Do not change function signatures.
- Do not break undo/redo, save/load, or auth.
- Touch AND mouse paths must both keep working.
- Measurements: internal **metres**, UI shows **mm** via the `mm()` helper.
- Dispose three.js geometry/materials/textures for any mesh you remove.

## Verified hooks you will use (these already exist in main.js)
`shiftDown`, `snapTo90()`, `snapWithGuides()`, `drawSnapGuide()`, `clearSnapGuides()`,
`previewWallPoints`, `drawPreviewPolygon()`, `clearPreview()`, `commitGlideDraw()`,
`weldCorners()`, `orthogonalisePoints()`, `lockRoom()`, `make2DLabel()`,
`rebuildAllCaps()`, `minorGrid`, `wallPopup` / `showWallPopup()`.
`floorMesh` does NOT exist yet — create it as a new global (Step 8).

## Steps

**Step 1 — Shift-lock to 90° in Quick Draw.**
Quick Draw currently force-locks every wall to 90° from `wallStart`. Change it so walls
follow the cursor freely, BUT snap to 90° if `shiftDown` is true OR the cursor is within 5°
of a 90° axis (use `snapTo90()`). Keep close-room snap and locked-length snap working.
Set `dimLabel` colour: green when 90°-snapped, blue when parallel-snapped, orange otherwise.

**Step 2 — Wire snap guide lines into Quick Draw.**
`drawSnapGuide()` and `snapWithGuides()` exist but aren't called from Quick Draw's
mousemove. Wire them: green dashed line when 90° to an existing wall, blue dashed when
parallel. Clear with `clearSnapGuides()` when no snap is active.

**Step 3 — Custom mm input for ceiling height + wall thickness.**
In `wallPopup`, ceiling height is a `<select>` of 2400/2700. Add a "Custom..." option that
reveals a number input (min 1000, max 5000 mm). Same for wall thickness: keep 110/150
presets, add "Custom..." revealing a number input (min 50, max 500 mm). Both update
`settings.ceilingHeight` / `settings.wallThickness` and call `rebuildAllCaps()` after Apply.

**Step 4 — Preset Room on desktop.**
The draw mode menu currently opens only on touch (`IS_TOUCH`). Also open it on desktop when
the user **long-presses (400ms)** OR **right-clicks** the "Draw Wall" button. Keep desktop
single-click launching Quick Draw. Touch behaviour unchanged.

**Step 5 — Preset Room: lock pan + live dimensions during preview.**
When `mode === 'draw-preset'` and `previewWallPoints.length > 0`:
- Disable OrbitControls pan, 2D pan, and pinch zoom.
- For each edge, render a midpoint dimension label (mm) using the `make2DLabel` canvas
  texture pattern. For each corner, render the interior angle in degrees.
- All labels orange, always face camera, always visible (also in 3D).
- Rebuild these labels every time `drawPreviewPolygon()` runs; clear them in `clearPreview()`.

**Step 6 — Preset Room: drag whole wall edge.**
In `mode === 'draw-preset'`, clicking/touching the MIDDLE of an edge (not a corner handle)
lets the user drag that edge perpendicular to its direction, moving both endpoint corners
together while preserving adjacent wall angles. Snap to grid. Live-update Step 5 labels.

**Step 7 — Freehand/Glide weld bug fix.**
In `commitGlideDraw()`, straight walls sometimes commit as 2 segments. After `weldCorners()`
and `orthogonalisePoints()`, add a pass merging collinear consecutive segments: if A→B→C are
collinear (within ~3°) AND B is not a corner of another wall, drop B. Repeat until stable.
A perfect rectangle must commit as exactly 4 walls.

**Step 8 — Auto floor on closed room.**
When `lockRoom()` fires (closed loop exists), add a `THREE.Shape`-based floor covering the
interior: colour #3a3530, `MeshStandardMaterial`, inset from walls by half wall thickness.
Remove/rebuild when walls change. Store in a new global `floorMesh` so save/load can recreate
it. Skip if floor already covered by `minorGrid`.

**Step 9 — Verify save/load still works.**
Walls and items must serialise/restore correctly. Auto floor regenerates from walls (no save
change needed). Custom ceiling/thickness values must save in `settings`.

## Test Plan (put as a checklist in the PR for a HUMAN to run on real devices)
- [ ] Desktop: long-press Draw Wall → Preset Room opens → Rectangle → drag corner shows live
      dims+angles → drag edge moves corners together → ✓ commits walls.
- [ ] iPad: same via the draw mode menu.
- [ ] Quick Draw: hold Shift → 90° snap; near existing wall axis → green guide + green label;
      parallel → blue.
- [ ] Freehand/Glide on a rectangle → exactly 4 walls.
- [ ] Close a room any way → floor appears.
- [ ] Wall popup → ceiling height "Custom" → 2550 → Apply → walls rebuild at 2550mm.
- [ ] Save project, reload → everything restores.
