# MAIN_JS_COUPLING.md

Coupling reference for `main.js` (~7732 lines). Read-only analysis — no code changes proposed.

---

### Table 1 — Module-scoped mutable state

| Name | Initial value | Mutating functions |
|------|---------------|-------------------|
| `settings` | `{ ceilingHeight: 2400, wallThickness: 110, gridSize: 100 }` | `loadScene`, wall-popup confirm (`wp-confirm`), elevation editor apply, `applyCabDim3DEdit`, `serialiseScene` (read); properties written in those paths |
| `scene` | `new THREE.Scene()` | `buildWall`, `syncOpeningsTo3D`, `clearWallOpeningMeshes`, `buildFloorMesh`, `placeProduct`, `loadProductModel`, `loadGlbFile` upload path, `clearScene`, `executeUndo`, `executeRedo`, `fdReplaceWall`, `resizeLockedWall`, drag/delete handlers, guide/preview helpers (`drawSnapGuide`, `clearPreview`, etc.) |
| `camera3D` | `PerspectiveCamera` at `(0,5,8)` | View-toggle handler, `loadScene`, `window.resize`, `animate` (indirect via controls) |
| `camera2D` | `OrthographicCamera` at `(0,50,0)` | 2D pan handlers (mouse/touch), view-toggle, `loadScene`, `updateOrtho` |
| `camera2D.userData` | `{ initialised: false }` | View-toggle handler, glide-draw entry, `loadScene` |
| `orthoSize` | `10` | Wheel/pinch zoom handlers, glide pinch, `loadScene`, `updateOrtho` |
| `activeCamera` | `camera3D` | View-toggle handler, glide-draw entry, `loadScene` |
| `is3D` | `true` | View-toggle handler, `loadScene` |
| `controls` | `OrbitControls(camera3D, …)` | Input handlers (enable/disable on drag), view-toggle, `loadScene`, touch-modifier dock, `animate` |
| `undoStack` | `[]` | `pushHistory`, `applyUndo`, `applyRedo`, `commitGlideDraw` (direct `undoStack.push` for `add-wall-batch`), `clearScene` |
| `redoStack` | `[]` | `pushHistory`, `applyUndo`, `applyRedo`, `commitGlideDraw`, `clearScene` |
| `walls` | `[]` | `buildWall`, `executeUndo`, `executeRedo`, Delete key handler, wall-popup delete, `resizeLockedWall`, `fdReplaceWall`, `clearScene` |
| `placedItems` | `[]` | `placeProduct`, `syncOpeningsTo3D`, `clearWallOpeningMeshes`, `loadProductModel`, import/duplicate paths, Delete handler, `executeUndo`/`executeRedo`, `clearScene`, touch/desktop delete |
| `wallCorners` | `[]` | `rebuildWallCorners`, `lockRoom`, `clearScene` |
| `mode` | `'select'` | Draw-mode entry buttons, `cancelWallDraw`, `cancelFreeDraw`, `commitGlideDraw`, `stopGlideDraw`, `clearScene`, `loadScene`, toolbar handlers |
| `hoveredWall` | `null` | Mousemove wall-hover logic |
| `selectedWall` | `null` | Click handlers, Delete, wall-popup, Free Draw (`fdShowEditor`, `fdDeselect`), multi-select clear, `resizeLockedWall`, `executeUndo` |
| `selectedItem` | `null` | Mouse/touch pick, Delete handler |
| `selectedWalls` | `[]` | `toggleWallMultiSelect`, `clearWallMultiSelect`, Delete key handler, click handlers |
| `selectedCabinets` | `[]` | `selectCabinet`, `deselectCabinet`, `clearCabinetSelection`, Delete key handler, click handlers |
| `wallXray` | `false` | `setWallXray`, hamburger menu |
| `selAnchor` | `'start'` | Wall-popup anchor UI, handle coloring |
| `shiftDown` | `false` | `keydown`/`keyup`, touch-modifier dock |
| `wallStart`, `firstPoint`, `previewLine`, `firstWallLocked` | `null` / `false` | `cancelWallDraw`, draw-wall mouse handlers, `updatePreview` |
| `dragTarget`, `dragStartPos`, `dragOffset` | `null` / `new Vector3()` | Mouse drag handlers (`mousedown`/`mousemove`/`mouseup`), touch drag path |
| `isPanning2D`, `panStart` | `false` / `Vector2` | 2D pan mouse/touch handlers |
| `activeTouches`, `lastPinchDist` | `Map()` / `null` | Touch pan/pinch handlers |
| `touchShiftActive`, `touchShiftLatched`, `touchCamLock`, `touchModifierCollapsed` | `false` | Touch-modifier dock handlers, `saveTouchModifierPrefs` |
| `_tmDragActive`, `_tmDragStartY`, `_tmDragStartTop`, `_tmDragMovedPx`, `_tmIdleTimer`, `_tmLastShiftDown` | various | Touch-modifier dock drag/idle handlers |
| `snapGuideH`, `snapGuideV`, `axisGuideX`, `axisGuideZ` | `null` | `drawSnapGuide`, `clearSnapGuides`, `updateAxisGuides`, `clearAxisGuides` |
| `roomCorners`, `roomLocked` | `[]` / `false` | `lockRoom`, `clearScene` |
| `floorMesh` | `null` | `buildFloorMesh`, `clearScene` |
| `drawModeActive` | `null` | Draw-mode menu handlers, `shouldLockCameraForCurrentTouchMode` |
| `previewWallPoints`, `freehandRawPoints` | `[]` | `handleDrawClick`, `confirmPreviewWalls`, `abortPreviewWalls`, `clearPreview`, preview-handle drag |
| `twoPtPhase`, `twoPtStart` | `0` / `null` | `handleDrawClick` |
| `draggingPreviewHdl`, `prevHdlOffset` | `null` / `Vector3` | Preview-handle pointer handlers |
| `previewMeshGroup` | `THREE.Group` (children) | `drawPreviewPolygon`, `clearPreview` |
| `wallDimLocked`, `wallDimLockedLen` | `false` / `0` | `showWallDimInput`, `hideWallDimInput`, draw-wall dim input handlers |
| `label2DObjects`, `labelEditorWall` | `[]` / `null` | `make2DLabel`, `refreshAll2DLabels`, `showLabelEditor`, `hideLabelEditor`, `clearScene` |
| `styleTargetWalls`, `styleBefore` | `[]` | `openWallStylePopup`, `closeWallStylePopup` |
| `cabinetBoxHelpers` | `new Map()` | `addCabinetBox`, `removeCabinetBox`, `clearCabinetSelection` |
| `cabDim3D` | `{ target, group, dims, labels, input, lastPos, lastRot }` | `buildCabDim3D`, `clearCabDim3D`, `update3DCabinetDims`, `openCabDim3DInput`, `applyCabDim3DEdit` |
| `elevWall`, `elevOpenings`, `elevCabinets` | `null` / `[]` | `openWallElevation`, `closeWallElevation`, elevation editor/drag handlers |
| `elevSelectedKind`, `elevSelectedItem`, `selectedOpening` | `null` | `selectElevItem`, `clearElevSelection`, elevation UI |
| `elevDragOp`, `elevDragOffsetMm`, `elevHoveredOp`, `elevHoveredCab` | drag state | Elevation canvas pointer handlers |
| `elevViewSide` | `'interior'` | Elevation view-side toggle |
| `elevDragCab`, `elevDragCabOffX`, `elevDragCabOffY` | drag state | Elevation cabinet drag |
| `_elevRMPan`, `_elevRMx`, `_elevRMy` | pan state | Elevation canvas mouse handlers |
| `elevZoom`, `elevPanX`, `elevPanY` | `1` / `0` | `elevZoomBy`, elevation pan/pinch, `closeWallElevation` |
| `_elevPinchActive`, `_elevPinchDist0`, `_elevPinchZoom0`, `_elevPinchPanX0`, `_elevPinchPanY0`, `_elevPinchCx0`, `_elevPinchCy0`, `_elevPinchJustEnded` | pinch state | Elevation touch handlers |
| `elevGreenDimRegions`, `elevOrangeDimRegions` | `[]` | `drawElevation`, green/orange dim hit tests |
| `elevWallLock` | `'start'` | Elevation wall-length editor |
| `products` | `[]` | `loadShopifyProducts`, `loadScene` (lookup) |
| `importedSceneCache` | `new Map()` | GLB upload handler, `addImportedProductToPanel` |
| `glbModalFile`, `glbModalScene`, `glbModalGltf` | `null` | `loadGlbFile`, `glbModalOpen`, `glbModalClose`, upload handler |
| `glbPreviewRenderer`, `glbPreviewCamera`, `glbPreviewControls`, `glbPhotoRenderer`, `glbPhotoCamera`, `glbPhotoControls` | `null` | `startGlbPreview`, `startGlbPhoto`, `stopGlbPreview`, `stopGlbPhoto` |
| `glbPreviewAnimId`, `glbPhotoAnimId` | `null` | Preview/photo animation loops, stop functions |
| `glbOriginalSize` | `new Vector3()` | `loadGlbFile` |
| `lastMouseX`, `lastMouseY` | `0` | `mousemove` handler |
| `dragCounter` | `0` | GLB drag-and-drop handlers |
| `touchSelectedModel`, `touchDragActive` | `null` / `false` | Touch overlay handlers |
| `floatPanelDragging`, `floatDragOffsetX`, `floatDragOffsetY` | `false` / `0` | Float panel drag |
| `rulerActive` | `false` | Touch ruler button |
| `desktopSelectedModel` | `null` | Desktop item panel show/hide |
| `freeStart`, `freeFirst`, `fdEndpointGuides` | draw-free state | Free-draw wall chain handlers |
| `fdSel`, `fdAnchor`, `fdSuppressClick`, `fdDragging` | Free Draw state | `fdSelectWall`, `fdDeselect`, `fdReplaceWall`, FD pointer handlers |
| `fdOrigStart`, `fdOrigEnd`, `fdDragRef`, `fdLastNs`, `fdLastNe` | `null` | FD slide-drag handlers |
| `fdRulerActive`, `fdRulerHoveredWall`, `fdRulerFloatingLabel`, `fdRulerPinnedLabels`, `fdRulerSide`, `fdRulerFirstWall` | ruler state | FD ruler handlers |
| `fdSplitLabelA`, `fdSplitLabelB`, `fdSplitHoveredWall` | split-label state | FD hover handlers |
| `glideActive`, `glideWasPinching`, `glidePointerDown`, `glideAnimId` | glide state | Glide pointer handlers, `commitGlideDraw`, `stopGlideDraw` |
| `glidePointers` | `new Map()` | Glide pointer handlers |
| `glidePoints`, `glidePreviewLines`, `glideCursorLine` | `[]` / `null` | `glideAddPoint`, `commitGlideDraw`, `stopGlideDraw` |
| `themeIndex` | from `localStorage` | `applyTheme`, theme menu handlers |
| `_wpTQDragging`, `_wpTQDragSX`, `_wpTQDragSY`, `_wpTQPopLeft`, `_wpTQPopTop`, `_wpTQPeeked`, `_wpTQMoreOpen` | wall-popup touch UI | `initWallPopupTouch`, `updateWallPopupTouchUI` |
| `IS_TOUCH` | `navigator.maxTouchPoints > 0` | **Never reassigned** (read-only flag; included per spec) |
| `raycaster`, `mouse` | constructed once | `updateMouse`, all raycast paths |
| `wallHandleGroup`, `wall2DLabelGroup`, `wall2DOverlayGroup` | `THREE.Group` children | `showWallHandles`, `clearWallHandles`, `make2DLabel`, `rebuild2DWallOverlays`, undo/redo, `clearScene` |

---

### Table 2 — Functions called from 3+ call sites

Call-site counts exclude the function's own definition line.

| Function name | Signature (params) | Call-site count | Example call sites (line numbers) |
|---------------|-------------------|-----------------|-----------------------------------|
| `mm` | `(v)` | 80 | 7, 478, 911, 2968, 4047 |
| `drawElevation` | `()` | 32 | 2378, 2399, 2891, 2904, 2913 |
| `rebuildAllCaps` | `()` | 22 | 151, 222, 925, 3156, 6684 |
| `rebuild2DWallOverlays` | `()` | 22 | 153, 222, 928, 3156, 6763 |
| `hideWallPopup` | `()` | 21 | 222, 433, 1299, 1551, 1626 |
| `updateRoomArea` | `()` | 20 | 155, 223, 930, 3157, 6680 |
| `refreshAll2DLabels` | `()` | 18 | 152, 222, 816, 3156, 6785 |
| `wallBaseColor` | `(w)` | 17 | 1387, 1450, 5534, 6559, 6706 |
| `pushHistory` | `(entry)` | 17 | 419, 932, 1494, 3155, 4057 |
| `getFloorPos` | `(e)` | 17 | 471, 3249, 3378, 5165, 5940 |
| `updateQuote` | `()` | 16 | 234, 4058, 4063, 4718, 6680 |
| `updateMouse` | `(e)` | 15 | 81, 466, 3176, 5514, 6037 |
| `snapToGrid` | `(p)` | 15 | 477, 3250, 5166, 5959, 6340 |
| `cornerKey` | `(v)` | 14 | 3020, 3027, 3071, 3078, 3110 |
| `syncOpeningsTo3D` | `(wallObj)` | 13 | 228, 256, 2903, 2950, 3151 |
| `showImportToast` | `(message, isError?)` | 12 | 4205, 4722, 7198, 7318, 7339 |
| `buildWall` | `(start, end, skipHistory?)` | 11 | 907, 3146, 3728, 6397, 6702 |
| `syncElevEditorFields` | `(item)` | 8 | 2598, 2889, 2902, 2926, 2939 |
| `showConfirmBar` | `(hint)` | 8 | 5192, 5892, 5925, 5997, 6231 |
| `updateOrtho` | `()` | 8 | 40, 55, 126, 4085, 6778 |
| `updateUndoRedoButtons` | `()` | 7 | 191, 205, 213, 6415, 6790 |
| `clearWallOpeningMeshes` | `(w)` | 7 | 247, 291, 423, 1566, 3140 |
| `drawGreenDim` | `(ctx, x1, y1, x2, y2, label, vertical, dimKey)` | 7 | 2266–2273 |
| `drawPreviewPolygon` | `(pts)` | 7 | 3579, 5941, 5948, 6015, 6360 |
| `clearPreview` | `()` | 7 | 3572, 3736, 3744, 5923, 6247 |
| `updateBackPlaneVisual` | `(modelClone)` | 7 | 4356, 4380, 4413, 4459, 4475 |
| `fdHandleColors` | `()` | 7 | 1271, 1576, 5537, 5627, 5670 |
| `drawDimLine` | `(ctx, x1, y1, x2, y2, label, vertical?)` | 7 | 1835, 2240–2242 |
| `removeGreenDimInput` | `()` | 6 | 2387, 2664, 2746, 2809 |
| `cancelWallDraw` | `()` | 6 | 410, 3519, 3532, 3837 |
| `fdDeselect` | `()` | 6 | 259, 321, 5531, 5541, 5879 |
| `centreAndFloor` | `(model)` | 6 | 4153, 4179, 4470, 4474, 4693 |
| `applyWallVisual` | `(w)` | 6 | 276, 926, 1414, 1449, 6708 |
| `showWallHandles` | `(wallObj)` | 6 | 154, 648, 1275, 5536, 5625 |
| `hideDrawModeMenu` | `()` | 6 | 3545, 3749, 5156, 5160, 5171 |
| `cancelFreeDraw` | `()` | 6 | 3522, 3837, 5349, 5385, 5488 |
| `update2DLabelVisibility` | `()` | 5 | 821, 929, 3865, 6762, 6787 |
| `drawArrow` | `(ctx, x, y, angle, size)` | 4 | 1849, 1850, 1856, 1857 |
| `selectElevItem` | `(kind, item)` | 4 | 2526, 2527, 2939, 2951 |
| `clearElevSelection` | `()` | 4 | 2652, 2911, 2917, 2927 |
| `commitGlideDraw` | `()` | 4 | 6243, 6430, 6528, 6541 |
| `lockRoom` | `()` | 4 | 2998, 3734, 6401, 6720 |
| `snapToCorner` | `(p, threshold?)` | 4 | 481, 3251, 5167, 6341 |
| `orthogonalisePoints` | `(rawPts)` | 4 | 3707, 5942, 6354, 6356 |
| `resizeElevCanvas` | `()` | 4 | 2378, 2649, 2658, 4086 |
| `clearWallMultiSelect` | `()` | 4 | 3459, 3466, 3482, 3491 |
| `applyTheme` | `(idx)` | 4 | 7682, 7729, 7730, 7731 |
| `hideConfirmBar` | `()` | 4 | 3544, 3735, 3747, 6248 |
| `updateWallPopupTouchUI` | `()` | 4 | 1065, 1140, 1191, 1299 |
| `glideAddPoint` | `(clientX, clientY)` | 3 | 6435, 6488, 6527 |
| `openingHitTest` | `(cx, cy, info)` | 3 | 2429, 2464, 2525 |
| `cabinetHitTest` | `(cx, cy, info)` | 3 | 2428, 2455, 2524 |
| `showWallPopup` | `(wallObj, sx, sy)` | 3 | 1190, 3476, 5589 |
| `disposeModel` | `(model)` | 3 | 4277, 4293, 6641 |
| `selectCabinet` | `(model, additive)` | 3 | 1357, 3200, 3470 |
| `deselectCabinet` | `(model)` | 3 | 429, 451, 1374 |
| `clearWallHandles` | `()` | 3 | 663, 1310, 5545 |
| `getFloorPosFromRay` | `(e)` | 3 | 3202, 3787, 5063 |
| `carryWallStyle` | `(src, dst)` | 3 | 1410, 3148, 5563 |
| `buildFloorMesh` | `()` | 3 | 708, 3009, 6718 |
| `handleDrawClick` | `(clientX, clientY)` | 3 | 106, 6025, 6026 |
| `writeCabinetTo3D` | `(cab)` | 3 | 2479, 2684, 2890 |
| `resizeLockedWall` | `(wallObj, newLengthM, anchorEnd?)` | 3 | 856, 1554, 3110 |
| `clearCabinetSelection` | `()` | 3 | 1352, 1369, 3453 |
| `fdReplaceWall` | `(oldWall, ns, ne)` | 3 | 1550, 5600, 5678 |
| `closeWallStylePopup` | `()` | 3 | 1512, 1513, 3425 |
| `applyWallStyleLive` | `()` | 3 | 1507, 1510, 1511 |
| `collectElevCabinets` | `()` | 3 | 1728, 2300, 2368 |
| `closeWallElevation` | `()` | 3 | 2381, 2955, 2958 |
| `hideWallDimInput` | `()` | 3 | 592, 3533, 3543 |
| `stopGlideDraw` | `()` | 3 | 6225, 6249, 6419 |
| `addOpening` | `(wallObj, type)` | 3 | 1626, 1627, 2987 |

---

### Table 3 — Undo/redo entry types

| type string | data shape | executeUndo branch (line) | executeRedo branch (line) |
|-------------|------------|---------------------------|---------------------------|
| `add-wall` | `{ wallObj }` — `wallObj` is `{ mesh, start, end, capMeshes, label2D, baseColor, opacity, openings? }` | 216 | 282 |
| `delete-wall` | `{ wallObj }` | 224 | 287 |
| `add-item` | `{ mesh }` — root `THREE.Object3D` in `placedItems` | 231 | 295 |
| `delete-item` | `{ mesh }` | 235 | 299 |
| `move-item` | `{ mesh, from: Vector3, to: Vector3 }` | 239 | 303 |
| `resize-wall` | `{ removed: wallObj[], restored: wallObj[] }` | 241 | 305 |
| `add-wall-batch` | `{ walls: wallObj[] }` — pushed directly via `undoStack.push` at ~6412 (bypasses `pushHistory`) | 261 | 323 |
| `style-walls` | `{ items: [{ wall, before: { color, opacity }, after: { color, opacity } }] }` | 271 | 331 |

**Mesh / object reference flags**

| type | Stores live object refs? |
|------|---------------------------|
| `add-wall`, `delete-wall`, `resize-wall`, `add-wall-batch` | **Yes** — `wallObj` (includes `mesh`) |
| `add-item`, `delete-item`, `move-item` | **Yes** — `mesh` (`from`/`to` are cloned `Vector3`) |
| `style-walls` | **Yes** — `wall` entries are live `wallObj` references |

`loadProductModel` history patch (~lines 894–900): scans `undoStack` and `redoStack`; for entries with `type === 'add-item'` and `entry.data.mesh === placeholderMesh`, replaces `entry.data.mesh` with the loaded GLB root. **No other entry types are currently patched.**

---

### Table 4 — userData fields on meshes

| Field | Where set (line) | Where read (line) | Notes |
|-------|------------------|-------------------|-------|
| `initialised` | ~32 (on `camera2D`, not a mesh) | 3857, 6205, 6752 | On `camera2D`; gates first-time 2D camera setup |
| `wallObj` | 657, 809, 921, 1613, 3354, 5048 | 148, 3224–3226, 3333, 3431, 3436, 3474, 3504–3506, 3786, 5027, 5132, 5517–5518, 5701–5702, 5761–5762, 5786–5787 | Back-pointer from wall mesh / handle / 2D label to planner `wallObj` record |
| `isWallHandle` | ~656 | (filtered via `wallHandleGroup`) | Marks draggable end-cap spheres |
| `handleIndex` | ~658 | 673–674, 3334, 5028, 5524–5525, 5626, 5660 | `0` = start, `1` = end |
| `previewHandleIndex` | ~3627 | 6039, 6043, 6080, 6084 | Draw-mode preview polygon corner handles |
| `product` | 882, 4054, 4227, 4710, 4962, 6887 | 2319–2321, 3366, 4069–4070, 4751–4754, 4793–4794, 5061, 5124, 6572, 6861, 6945, 6995, 7115 | Shopify/imported product metadata for quote, cart, dims |
| `skuIndex` | 4054, 4227, 4710, 6738 | 4070, 4754, 6582, 6594 | Selected SKU index into `product.skus` |
| `type` | ~2981 (`'door'` \| `'window'`) | 2320, 3441, 4753, 5124, 6580 | Opening kind; excluded from quote/cart/selection |
| **`parentWall`** | **~2981** (`syncOpeningsTo3D`) | **2963, 3064** | **⚠️ DELETION MARKER: `syncOpeningsTo3D` and `clearWallOpeningMeshes` remove every `placedItems` entry where `userData.parentWall === wallObj` before rebuilding opening meshes. Any cabinet mistakenly given `parentWall` would be deleted on opening sync. NEVER set `parentWall` on auto-generated cabinets — use `autoWall: { specHash, wallIndex }` instead.** |

Child GLB meshes inherit parent `userData` via `traverse` at ~886, 4229, 4712.

---

### Table 5 — Async boundaries

| Function | Async trigger | What it patches/updates afterward |
|----------|---------------|-----------------------------------|
| `shopifyFetch(query, variables)` | `fetch(SHOPIFY_ENDPOINT, …)` | Returns GraphQL JSON to callers |
| `fetchAllShopifyProducts()` | Paginated `await shopifyFetch(PRODUCTS_QUERY, …)` | Returns raw Shopify product nodes |
| `loadShopifyProducts()` | `await fetchAllShopifyProducts()` (called at ~4043 on load) | Sets `products`, calls `renderProductPanel()` |
| `loadProductModel(product, placeholderMesh)` | `gltfLoader.load(product.modelPath, …)` | Replaces placeholder in scene/`placedItems`; copies `userData`; **patches `undoStack`/`redoStack` `add-item` entries only** — other entry types holding mesh refs are NOT currently patched |
| `loadGlbFile(file)` | `gltfLoader.load(objectURL, …)` | Sets `glbModalFile`/`glbModalGltf`/`glbModalScene`, pre-fills modal inputs, `glbModalOpen()`, `setTimeout(→ startGlbPreview, 80)` |
| `startGlbPreview` / GLB photo loop | `requestAnimationFrame` | Renders isolated preview scenes (modal only) |
| `btn-send-cart` click handler | `await shopifyFetch(CART_CREATE_MUTATION, …)` | Redirects to `checkoutUrl` or shows toast on error |
| `signInWithGoogle()` | OAuth via Supabase (`auth.js`; called without `await`) | Redirect / session (UI updated by `initAuth` listener) |
| `initAuth()` | `_client.auth.getSession().then(…)` in `auth.js` | `updateAuthUI()` — show/hide save & projects buttons |
| `btn-auth-signout` handler | `await signOut()` | Closes auth modal |
| `btn-save-project` handler | `await saveProject(name, sceneJson, thumbnail)` | Toast on success/failure; warns about skipped imported GLBs |
| `openProjectsModal()` | `await listProjects()` | `renderProjectsList(data)` |
| `handleLoadProject(id)` | `await loadProject(id)` | `loadScene(data.scene_json)` → full scene rebuild |
| `handleDeleteProject(id, name)` | `await deleteProject(id)` then `await listProjects()` | Re-renders projects list |
| `animate()` | `requestAnimationFrame(animate)` | `controls.update()`, `updateCabinetBoxes()`, `update3DCabinetDims()`, `renderer.render` |
| Elevation `requestAnimationFrame` callbacks | After open/resize | `resizeElevCanvas()`, `drawElevation()` |
| `showImportToast` | `setTimeout` fade/remove | DOM only |
| `openWallElevation` | `requestAnimationFrame` | `resizeElevCanvas()`, `drawElevation()` |

**Note:** `updateProject` is exported from `auth.js` but **not called** from `main.js`.
