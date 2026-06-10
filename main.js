import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initAuth, signInWithGoogle, signOut, saveProject, listProjects, loadProject, deleteProject } from './auth.js';
const IS_TOUCH = navigator.maxTouchPoints > 0;
const mm = v => v / 1000;
const SLAB_H = mm(300);   // floor slab height — walls sit on top of this
const settings = { ceilingHeight: 2400, wallThickness: 110, gridSize: 100 };

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'default'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera3D = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
camera3D.position.set(0, 5, 8);
camera3D.lookAt(0, 0, 0);

let orthoSize = 10;
const camera2D = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 200);
camera2D.position.set(0, 50, 0);
camera2D.up.set(0, 0, -1);
camera2D.lookAt(0, 0, 0);
// ✅ FIX: track whether 2D camera has been initialised so pan state is preserved
camera2D.userData.initialised = false;

function updateOrtho() {
  const a = window.innerWidth / window.innerHeight;
  camera2D.left = -orthoSize * a; camera2D.right = orthoSize * a;
  camera2D.top = orthoSize; camera2D.bottom = -orthoSize;
  camera2D.updateProjectionMatrix();
}
updateOrtho();

let activeCamera = camera3D;
let is3D = true;

const controls = new OrbitControls(camera3D, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.3;
controls.maxDistance = 50;

window.addEventListener('wheel', (e) => {
  if (is3D) return;
  const normDelta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  orthoSize = Math.max(0.5, Math.min(30, orthoSize + normDelta * 0.005));
  updateOrtho();
}, { passive: true });

let isPanning2D = false;
let panStart = new THREE.Vector2();
canvas.addEventListener('mousedown', (e) => {
  if (!is3D && e.button === 2) { isPanning2D = true; panStart.set(e.clientX, e.clientY); }
});
window.addEventListener('mousemove', (e) => {
  if (!isPanning2D) return;
  const s = orthoSize / 400;
  camera2D.position.x -= (e.clientX - panStart.x) * s;
  camera2D.position.z -= (e.clientY - panStart.y) * s;
  panStart.set(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => { isPanning2D = false; });

// ✅ FIX: Touch support — pointer events for pan, pinch-zoom, and wall drawing
let activeTouches = new Map();
let lastPinchDist = null;

canvas.addEventListener('touchstart', (e) => {
  if (mode === 'draw-glide') return;
    // Check for wall handle tap on iPad
    if (e.touches.length === 1) {
      const t = e.touches[0];
      updateMouse({ clientX: t.clientX, clientY: t.clientY });
      raycaster.setFromCamera(mouse, activeCamera);
      const handleHits = raycaster.intersectObjects(wallHandleGroup.children);
      if (handleHits.length > 0) {
        canvas._draggingHandle = handleHits[0].object;
        controls.enabled = false;
        e.preventDefault();
        return;
      }
    }
  
  e.preventDefault();
  Array.from(e.changedTouches).forEach(t => activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY }));
  if (activeTouches.size === 1 && !is3D && !touchDragActive && mode !== 'draw-wall' && mode !== 'draw-freehand' && mode !== 'draw-twopoint') {
    const t = e.changedTouches[0];
    panStart.set(t.clientX, t.clientY);
    isPanning2D = true;
  }  if (activeTouches.size === 2) {
    isPanning2D = false;
    const pts = Array.from(activeTouches.values());
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
  if (activeTouches.size === 1 && (mode === 'draw-wall' || mode === 'draw-freehand' || mode === 'draw-twopoint')) {
    const t = e.changedTouches[0];
    if (mode === 'draw-freehand' || mode === 'draw-twopoint') {
      handleDrawClick(t.clientX, t.clientY);
    } else {
      const synth = new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true });
      canvas.dispatchEvent(synth);
    }
  }
  

}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (mode === 'draw-glide') return;
  e.preventDefault();
  Array.from(e.changedTouches).forEach(t => activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY }));
  if (activeTouches.size === 2) {
    const pts = Array.from(activeTouches.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastPinchDist !== null && !is3D) {
      const delta = lastPinchDist - dist;
      orthoSize = Math.max(0.5, Math.min(30, orthoSize + delta * 0.01));
      updateOrtho();
    }
    lastPinchDist = dist;
    return;
  }
  if (isPanning2D && activeTouches.size === 1 && mode !== 'draw-wall') {
    const t = e.changedTouches[0];
    const s = orthoSize / 400;
    camera2D.position.x -= (t.clientX - panStart.x) * s;
    camera2D.position.z -= (t.clientY - panStart.y) * s;
    panStart.set(t.clientX, t.clientY);
  }
  if (activeTouches.size === 1 && mode === 'draw-wall') {
    const t = e.changedTouches[0];
    const synth = new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true });
    canvas.dispatchEvent(synth);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    // Release wall handle drag on iPad
    if (canvas._draggingHandle) {
      const wallObj = canvas._draggingHandle.userData.wallObj;
      canvas._draggingHandle = null;
      controls.enabled = true;
      rebuildAllCaps();
      refreshAll2DLabels();
      rebuild2DWallOverlays();
      showWallHandles(wallObj);
      updateRoomArea();
      return;
    }
  
  Array.from(e.changedTouches).forEach(t => activeTouches.delete(t.identifier));
  if (activeTouches.size < 2) lastPinchDist = null;
  if (activeTouches.size === 0) isPanning2D = false;
}, { passive: false });

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const minorGrid = new THREE.GridHelper(20, 40, 0x2d2d2d, 0x2d2d2d);
minorGrid.position.y = 0.001;
scene.add(minorGrid);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
floor.rotation.x = -Math.PI / 2;
floor.name = 'floor';
scene.add(floor);

const MAX_HISTORY = 20;
let undoStack = [];
let redoStack = [];

function pushHistory(entry) {
  console.log('PUSH:', entry.type, undoStack.length + 1);
  undoStack.push(entry);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}
function applyUndo() {
  if (!undoStack.length) return;
  const entry = undoStack.pop();
  redoStack.push(entry);
  if (redoStack.length > MAX_HISTORY) redoStack.shift();
  executeUndo(entry);
  updateUndoRedoButtons();
}
function applyRedo() {
  if (!redoStack.length) return;
  const entry = redoStack.pop();
  undoStack.push(entry);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  executeRedo(entry);
  updateUndoRedoButtons();
}
function executeUndo(entry) {
  if (entry.type === 'add-wall') {
    const w = entry.data.wallObj;
    scene.remove(w.mesh);
    if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
    if (w.label2D) wall2DLabelGroup.remove(w.label2D);
    walls = walls.filter(x => x !== w);
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea();
  } else if (entry.type === 'delete-wall') {
    scene.add(entry.data.wallObj.mesh);
    walls.push(entry.data.wallObj);
    if (entry.data.wallObj.openings && entry.data.wallObj.openings.length)
      syncOpeningsTo3D(entry.data.wallObj);
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
    updateRoomArea();
  } else if (entry.type === 'add-item') {
    scene.remove(entry.data.mesh);
    placedItems = placedItems.filter(x => x !== entry.data.mesh);
    updateQuote();
  } else if (entry.type === 'delete-item') {
    scene.add(entry.data.mesh);
    placedItems.push(entry.data.mesh);
    updateQuote();
  } else if (entry.type === 'move-item') {
    entry.data.mesh.position.copy(entry.data.from);
  } else if (entry.type === 'resize-wall') {
    // Remove the NEW walls (restored)
    entry.data.restored.forEach(w => {
      scene.remove(w.mesh);
      if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
      if (w.label2D) wall2DLabelGroup.remove(w.label2D);
      clearWallOpeningMeshes(w);
      walls = walls.filter(x => x !== w);
      if (selectedWall === w) selectedWall = null;

    });
    // Add back the OLD walls (removed)
    entry.data.removed.forEach(w => {
      scene.add(w.mesh);
      if (!walls.includes(w)) walls.push(w);
      if (w.openings && w.openings.length) syncOpeningsTo3D(w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    if (mode === 'draw-free') fdDeselect();   // drop stale Free Draw selection/handles
    updateRoomArea();
  } else if (entry.type === 'add-wall-batch') {
    entry.data.walls.forEach(w => {
      scene.remove(w.mesh);
      if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
      if (w.label2D) wall2DLabelGroup.remove(w.label2D);
      walls = walls.filter(x => x !== w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea();

  } else if (entry.type === 'style-walls') {
    entry.data.items.forEach(it => {
      if (!walls.includes(it.wall)) return;
      it.wall.baseColor = it.before.color;
      it.wall.opacity   = it.before.opacity;
      applyWallVisual(it.wall);
    });
    rebuildAllCaps();
  }  
}
function executeRedo(entry) {
  if (entry.type === 'add-wall') {
    scene.add(entry.data.wallObj.mesh);
    walls.push(entry.data.wallObj);
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
    updateRoomArea();
  } else if (entry.type === 'delete-wall') {
    scene.remove(entry.data.wallObj.mesh);
    if (entry.data.wallObj.capMeshes) entry.data.wallObj.capMeshes.forEach(c => scene.remove(c));
    if (entry.data.wallObj.label2D) wall2DLabelGroup.remove(entry.data.wallObj.label2D);
    clearWallOpeningMeshes(entry.data.wallObj);
    walls = walls.filter(x => x !== entry.data.wallObj);
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea();
  } else if (entry.type === 'add-item') {
    scene.add(entry.data.mesh);
    placedItems.push(entry.data.mesh);
    updateQuote();
  } else if (entry.type === 'delete-item') {
    scene.remove(entry.data.mesh);
    placedItems = placedItems.filter(x => x !== entry.data.mesh);
    updateQuote();
  } else if (entry.type === 'move-item') {
    entry.data.mesh.position.copy(entry.data.to);
  } else if (entry.type === 'resize-wall') {
    // Remove the OLD walls (removed)
    entry.data.removed.forEach(w => {
      scene.remove(w.mesh);
      if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
      if (w.label2D) wall2DLabelGroup.remove(w.label2D);
      clearWallOpeningMeshes(w);
      walls = walls.filter(x => x !== w);
    });
    // Add back the NEW walls (restored)
    entry.data.restored.forEach(w => {
      scene.add(w.mesh);
      if (!walls.includes(w)) walls.push(w);
      if (w.openings && w.openings.length) syncOpeningsTo3D(w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    if (mode === 'draw-free') fdDeselect();   // drop stale Free Draw selection/handles
    updateRoomArea();
  } else if (entry.type === 'add-wall-batch') {
    entry.data.walls.forEach(w => {
      scene.add(w.mesh);
      if (!walls.includes(w)) walls.push(w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
    updateRoomArea();

  } else if (entry.type === 'style-walls') {
    entry.data.items.forEach(it => {
      if (!walls.includes(it.wall)) return;
      it.wall.baseColor = it.after.color;
      it.wall.opacity   = it.after.opacity;
      applyWallVisual(it.wall);
    });
    rebuildAllCaps();
  }  
}

let glbModalFile        = null;
let glbModalScene       = null;
let glbModalGltf        = null;
let glbPreviewRenderer  = null;
let glbPreviewCamera    = null;
let glbPreviewControls  = null;
let glbPhotoRenderer    = null;
let glbPhotoCamera      = null;
let glbPhotoControls    = null;
let glbPhotoAnimId      = null;
let glbPreviewAnimId    = null;
let glbOriginalSize     = new THREE.Vector3();
let lastMouseX = 0;
let lastMouseY = 0;

let mode = 'select';
let hoveredWall = null;
let placedItems = [], walls = [], wallCorners = [];
let wallStart = null, firstPoint = null, previewLine = null;
let firstWallLocked = false;

let dragTarget = null, dragStartPos = null, selectedWall = null, selectedItem = null;
let selectedWalls = [];                 // Task C: Ctrl/Cmd + left-click multi-selection (Select mode)
const WALL_MULTI_COLOR = 0x00bcd4;      // cyan highlight for multi-selected walls
let wallXray = false;                   // Task E: global see-through-walls toggle (view only)
const XRAY_OPACITY = 0.22;              // forced opacity while X-ray is on
let selAnchor = 'start';                // Task B: which wall end stays fixed when resizing in Select mode
let shiftDown = false;

// ── Touch Modifier Dock state ────────────────────────────
let touchShiftActive       = false;   // true while shift button is held
let touchShiftLatched      = false;   // true when double-tap latched on
let touchCamLock           = false;   // persistent cam-lock toggle
let touchModifierCollapsed = false;   // dock collapsed to restore tab
let _tmDragActive          = false;
let _tmDragStartY          = 0;
let _tmDragStartTop        = 0;
let _tmDragMovedPx         = 0;       // px moved in current drag (conflict guard)
let _tmIdleTimer           = null;    // handle for idle-fade timeout
let _tmLastShiftDown       = 0;       // ms timestamp of last shift pointerdown (double-tap)
const TM_LS_TOP       = 'bbk-tm-top';
const TM_LS_COLLAPSED = 'bbk-tm-collapsed';
const TM_LS_CAMLOCK   = 'bbk-tm-camlock';
const TM_LS_HINT_SEEN = 'bbk-tm-hint-seen';
const TM_IDLE_MS      = 2000;         // ms before dock fades to idle opacity

let snapGuideH = null, snapGuideV = null;
let axisGuideX = null, axisGuideZ = null;
let roomCorners = [], roomLocked = false;
let floorMesh = null;
// ── Draw Mode State ──────────────────────────────────────
let drawModeActive     = null;   // 'quick' | 'preset' | 'freehand' | 'twopoint'
let previewWallPoints  = [];     // confirmed polygon corners (Vector3 array)
let freehandRawPoints  = [];     // raw tapped points before snapping
let twoPtPhase         = 0;      // 0 = awaiting first click, 1 = awaiting second
let twoPtStart         = null;   // first corner (Vector3)
let draggingPreviewHdl = null;   // index into previewWallPoints, or null
let prevHdlOffset      = new THREE.Vector3();

// Preview geometry group — dotted lines + fill + corner handles
const previewMeshGroup = new THREE.Group();
previewMeshGroup.name  = 'drawPreview';
scene.add(previewMeshGroup);


window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') shiftDown = true;
  // In Free Draw, let its dedicated Escape handler run (ruler first, then exit) — see below.
  if (e.key === 'Escape' && mode !== 'draw-free') cancelWallDraw();
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    // Multi-selection delete (Ctrl/Cmd-selected walls and/or cabinets) takes priority.
    // Each item still pushes its own undo entry, so undo/redo keeps working per item.
    if (selectedWalls.length || selectedCabinets.length) {
      selectedWalls.slice().forEach(w => {
        if (!walls.includes(w)) return;
        pushHistory({ type: 'delete-wall', data: { wallObj: w } });
        scene.remove(w.mesh);
        if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
        if (w.label2D) wall2DLabelGroup.remove(w.label2D);
        clearWallOpeningMeshes(w);
        walls = walls.filter(x => x !== w);
      });
      selectedWalls = [];
      selectedCabinets.slice().forEach(m => {
        pushHistory({ type: 'delete-item', data: { mesh: m } });
        deselectCabinet(m);                       // dispose cyan box + drop from selection
        scene.remove(m);
        placedItems = placedItems.filter(x => x !== m);
      });
      if (selectedWall && !walls.includes(selectedWall)) { selectedWall = null; hideWallPopup(); }
      selectedItem = null;
      rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
      updateRoomArea(); updateQuote();
      return;
    }

    if (selectedWall) {
      pushHistory({ type: 'delete-wall', data: { wallObj: selectedWall } });
      scene.remove(selectedWall.mesh);
      if (selectedWall.capMeshes) selectedWall.capMeshes.forEach(c => scene.remove(c));
      if (selectedWall.label2D) wall2DLabelGroup.remove(selectedWall.label2D);
      clearWallOpeningMeshes(selectedWall);
      walls = walls.filter(w => w !== selectedWall);
      rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
      updateRoomArea();
    } else if (selectedItem) {
      pushHistory({ type: 'delete-item', data: { mesh: selectedItem } });
      deselectCabinet(selectedItem);
      scene.remove(selectedItem);
      placedItems = placedItems.filter(x => x !== selectedItem);
      selectedItem = null;
      updateQuote();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); applyUndo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); applyRedo(); }
});
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') shiftDown = false; });

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function updateMouse(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
}
function getFloorPos(e) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const hits = raycaster.intersectObject(floor);
  return hits.length > 0 ? hits[0].point.clone() : null;
}
function snapToGrid(p) {
  const s = mm(settings.gridSize);
  return new THREE.Vector3(Math.round(p.x / s) * s, 0, Math.round(p.z / s) * s);
}
function snapToCorner(p, threshold = 0.2) {
  let closest = null, minDist = threshold;
  wallCorners.forEach(c => { const d = p.distanceTo(c); if (d < minDist) { minDist = d; closest = c.clone(); } });
  return closest || p;
}
function snapTo90(p) {
  if (!wallStart || !shiftDown) return p;
  const dx = Math.abs(p.x - wallStart.x), dz = Math.abs(p.z - wallStart.z);
  return dx > dz ? new THREE.Vector3(p.x, 0, wallStart.z) : new THREE.Vector3(wallStart.x, 0, p.z);
}
function snapWithGuides(rawPoint) {
  if (!wallStart || walls.length === 0) return { point: rawPoint, type: null };
  const threshold = mm(200);
  let bestPoint = rawPoint.clone(), bestType = null;
  walls.forEach(w => {
    const wdx = w.end.x - w.start.x, wdz = w.end.z - w.start.z;
    const wLen = Math.sqrt(wdx * wdx + wdz * wdz);
    if (wLen < 0.001) return;
    const along = new THREE.Vector3(wdx / wLen, 0, wdz / wLen);
    const perp  = new THREE.Vector3(-wdz / wLen, 0, wdx / wLen);
    const dx = rawPoint.x - wallStart.x, dz = rawPoint.z - wallStart.z;
    const totalLen = Math.sqrt(dx * dx + dz * dz);
    if (totalLen < 0.001) return;
    const parallelScore = Math.abs((along.x * dx + along.z * dz) / totalLen);
    const perpScore     = Math.abs((perp.x  * dx + perp.z  * dz) / totalLen);
    if (perpScore > 0.98) {
      const proj = perp.x * dx + perp.z * dz;
      const candidate = new THREE.Vector3(wallStart.x + perp.x * proj, 0, wallStart.z + perp.z * proj);
      if (candidate.distanceTo(rawPoint) < threshold) { bestPoint = candidate; bestType = '90deg'; }
    } else if (parallelScore > 0.98) {
      const proj = along.x * dx + along.z * dz;
      const candidate = new THREE.Vector3(wallStart.x + along.x * proj, 0, wallStart.z + along.z * proj);
      if (candidate.distanceTo(rawPoint) < threshold) { bestPoint = candidate; bestType = 'parallel'; }
    }
  });
  return { point: bestPoint, type: bestType };
}
function drawSnapGuide(point, type) {
  if (snapGuideH) { scene.remove(snapGuideH); snapGuideH = null; }
  if (snapGuideV) { scene.remove(snapGuideV); snapGuideV = null; }
  if (!type || !wallStart) return;
  const color = type === '90deg' ? 0x00ff88 : 0x4488ff;
  const guideLen = 20;
  const dx = point.x - wallStart.x, dz = point.z - wallStart.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.001) return;
  const nx = dx / len, nz = dz / len;
  snapGuideH = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(point.x - nx * guideLen, 0.03, point.z - nz * guideLen),
      new THREE.Vector3(point.x + nx * guideLen, 0.03, point.z + nz * guideLen),
    ]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
  );
  scene.add(snapGuideH);
}
function clearSnapGuides() {
  if (snapGuideH) { scene.remove(snapGuideH); snapGuideH = null; }
  if (snapGuideV) { scene.remove(snapGuideV); snapGuideV = null; }
}
function updateAxisGuides(currentPoint) {
  if (axisGuideX) { scene.remove(axisGuideX); axisGuideX = null; }
  if (axisGuideZ) { scene.remove(axisGuideZ); axisGuideZ = null; }
  if (!firstPoint || !wallStart) return;
  const snapThreshold = mm(150), guideLen = 20;
  const mat = new THREE.LineBasicMaterial({ color: 0x00cc44, transparent: true, opacity: 0.7 });
  if (Math.abs(currentPoint.z - firstPoint.z) < snapThreshold) {
    axisGuideZ = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-guideLen, 0.035, firstPoint.z),
        new THREE.Vector3( guideLen, 0.035, firstPoint.z),
      ]), mat.clone()
    );
    scene.add(axisGuideZ);
  }
  if (Math.abs(currentPoint.x - firstPoint.x) < snapThreshold) {
    axisGuideX = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(firstPoint.x, 0.035, -guideLen),
        new THREE.Vector3(firstPoint.x, 0.035,  guideLen),
      ]), mat.clone()
    );
    scene.add(axisGuideX);
  }
}
function clearAxisGuides() {
  if (axisGuideX) { scene.remove(axisGuideX); axisGuideX = null; }
  if (axisGuideZ) { scene.remove(axisGuideZ); axisGuideZ = null; }
}

const dimLabel = document.createElement('div');
dimLabel.style.cssText = 'position:fixed;background:#ffffff;color:#333;padding:10px 20px;border-radius:8px;font:bold 16px Arial;pointer-events:none;display:none;z-index:50;box-shadow:0 2px 12px rgba(0,0,0,0.3);border:2px solid #ff9500;min-width:100px;text-align:center;';

document.body.appendChild(dimLabel);

// ── Floating wall dimension input ─────────────────────────
const wallDimInput  = document.getElementById('wall-dim-input');
const wallDimValue  = document.getElementById('wall-dim-value');
let   wallDimLocked    = false;
let   wallDimLockedLen = 0;

function showWallDimInput(midScreenX, midScreenY, currentLenMm) {
  wallDimInput.style.display = 'flex';
  wallDimInput.style.left = Math.round(midScreenX - 60) + 'px';
  wallDimInput.style.top  = Math.round(midScreenY - 48) + 'px';
  if (!wallDimLocked) {
    wallDimValue.value = currentLenMm;
  }
  wallDimValue.focus();
}

function hideWallDimInput() {
  wallDimInput.style.display = 'none';
  wallDimInput.style.boxShadow = '';
  wallDimLocked      = false;
  wallDimLockedLen   = 0;
  wallDimValue.value = '';
}

wallDimValue.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    const v = parseFloat(wallDimValue.value);
    if (!isNaN(v) && v >= 50) {
      wallDimLocked    = true;
      wallDimLockedLen = mm(v);

    }
  }

  if (e.key === 'Escape') {
    wallDimLocked    = false;
    wallDimLockedLen = 0;
  }
});

wallDimInput.addEventListener('click',     (e) => e.stopPropagation());
wallDimInput.addEventListener('mousedown', (e) => e.stopPropagation());
wallDimInput.addEventListener('touchstart',(e) => e.stopPropagation());
wallDimInput.addEventListener('pointerdown',(e) => e.stopPropagation());


const closeHint = document.createElement('div');
closeHint.style.cssText = 'position:fixed;background:rgba(0,200,100,0.92);color:#fff;padding:4px 10px;border-radius:4px;font:bold 12px Arial;pointer-events:none;display:none;z-index:50;';
closeHint.textContent = 'Close Room';
document.body.appendChild(closeHint);

function updatePreview(end) {
  if (previewLine) scene.remove(previewLine);
  previewLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(wallStart.x, 0.02, wallStart.z),
      new THREE.Vector3(end.x, 0.02, end.z)
    ]),
    new THREE.LineBasicMaterial({ color: 0xff9500 })
  );
  scene.add(previewLine);
}

function rebuildWallCorners() {
  wallCorners = [];
  walls.forEach(w => {
    wallCorners.push(w.start.clone(), w.end.clone());
  });
}

function showWallHandles(wallObj) {
  clearWallHandles();
  [wallObj.start, wallObj.end].forEach((pt, i) => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(IS_TOUCH ? 0.22 : 0.15, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sphere.position.set(pt.x, 0.08, pt.z);
    sphere.userData.isWallHandle = true;
    sphere.userData.wallObj = wallObj;
    sphere.userData.handleIndex = i;
    wallHandleGroup.add(sphere);
  });
}

function clearWallHandles() {
  while (wallHandleGroup.children.length > 0) {
    wallHandleGroup.remove(wallHandleGroup.children[0]);
  }
}

// Task B: green = anchored (fixed) end, white = moving end. Generic version of
// the Free Draw handle colouring, reusable from Select mode.
function colorWallHandles(anchorName) {
  wallHandleGroup.children.forEach(h => {
    const isAnchor = (h.userData.handleIndex === 0 && anchorName === 'start') ||
                     (h.userData.handleIndex === 1 && anchorName === 'end');
    h.material.color.set(isAnchor ? 0x00ff88 : 0xffffff);
  });
}

function rebuildAllCaps() {
  rebuildWallCorners();
  walls.forEach(w => {
    if (w.capMeshes) { w.capMeshes.forEach(c => scene.remove(c)); w.capMeshes = []; }
  });
  const t = mm(settings.wallThickness), h = mm(settings.ceilingHeight);
  const cornerMap = new Map();
  walls.forEach(w => {
    const sk = cornerKey(w.start), ek = cornerKey(w.end);
    if (!cornerMap.has(sk)) cornerMap.set(sk, []);
    if (!cornerMap.has(ek)) cornerMap.set(ek, []);
    cornerMap.get(sk).push(w);
    cornerMap.get(ek).push(w);
  });
  cornerMap.forEach((wallList, key) => {
    if (wallList.length < 2) return;
    const [x, z] = key.split(',').map(Number);
    const owner = wallList[0];
    const ownerOp = wallXray ? XRAY_OPACITY : ((owner.opacity != null) ? owner.opacity : 1);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(t, h, t),
      new THREE.MeshStandardMaterial({ color: wallBaseColor(owner), transparent: ownerOp < 1, opacity: ownerOp })
    );
    cap.position.set(x, SLAB_H + h / 2, z);
    cap.castShadow = cap.receiveShadow = true;
    scene.add(cap);
    if (!owner.capMeshes) owner.capMeshes = [];
    owner.capMeshes.push(cap);
  });
  buildFloorMesh();
}
function cornerKey(v) {
  return Math.round(v.x * 1000) / 1000 + ',' + Math.round(v.z * 1000) / 1000;
}

// ✅ FIX: Room area — shoelace formula, updates whenever walls change
function calcRoomArea(corners) {
  // corners: array of THREE.Vector3 using x and z as the floor plane
  if (corners.length < 3) return 0;
  let area = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    area += a.x * b.z;
    area -= b.x * a.z;
  }
  return Math.abs(area) / 2; // m²
}

function updateRoomArea() {
  const el = document.getElementById('room-area');
  if (!el) return;
  if (walls.length < 3) { el.textContent = ''; return; }

  const ordered = [];
  const remaining = [...walls];
  let current = remaining.shift();
  ordered.push(current);

  for (let i = 0; i < walls.length - 1; i++) {
    const lastEnd = current.end;
    const nextIdx = remaining.findIndex(w =>
      w.start.distanceTo(lastEnd) < 0.01 ||
      w.end.distanceTo(lastEnd) < 0.01
    );
    if (nextIdx === -1) break;
    const next = remaining.splice(nextIdx, 1)[0];
    if (next.end.distanceTo(lastEnd) < 0.01) {
      ordered.push({ start: next.end, end: next.start });
    } else {
      ordered.push(next);
    }
    current = ordered[ordered.length - 1];
  }

  if (ordered.length < 3) { el.textContent = ''; return; }

  const pts = ordered.map(w => w.start);
  const area = calcRoomArea(pts);
  el.textContent = 'Area: ' + area.toFixed(2) + ' m²';
}


const wallHandleGroup = new THREE.Group();
wallHandleGroup.name = 'wallHandles';
scene.add(wallHandleGroup);

const wall2DLabelGroup = new THREE.Group();
wall2DLabelGroup.name = 'wall2DLabels';
scene.add(wall2DLabelGroup);
let label2DObjects = [];

function make2DLabel(wallObj) {
  if (wallObj.label2D) {
    const oldMat = wallObj.label2D.material;
    if (oldMat.map) oldMat.map.dispose();   // ← frees GPU texture
    oldMat.dispose();                        // ← frees GPU material
    wall2DLabelGroup.remove(wallObj.label2D);
    label2DObjects = label2DObjects.filter(x => x.mesh !== wallObj.label2D);
    wallObj.label2D = null;
  }
  const lenMm = Math.round(wallObj.start.distanceTo(wallObj.end) * 1000);
  const t = mm(settings.wallThickness);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(255,149,0,0.95)';
  ctx.beginPath(); ctx.roundRect(4, 4, 248, 56, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(lenMm + 'mm', 118, 32);
  ctx.font = '18px Arial';
  ctx.fillText('BT', 232, 32);
  const angle = Math.atan2(wallObj.end.x - wallObj.start.x, wallObj.end.z - wallObj.start.z);
  const perpX = Math.cos(angle) * (t / 2 + 0.18);
  const perpZ = -Math.sin(angle) * (t / 2 + 0.18);
  const mid = new THREE.Vector3(
    (wallObj.start.x + wallObj.end.x) / 2, 0.05,
    (wallObj.start.z + wallObj.end.z) / 2
  );
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.175),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false })
  );
  labelMesh.position.set(mid.x + perpX, 0.06, mid.z + perpZ);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.renderOrder = 999;
  labelMesh.userData.wallObj = wallObj;
  labelMesh.visible = false;

  wall2DLabelGroup.add(labelMesh);
  wallObj.label2D = labelMesh;
  label2DObjects.push({ mesh: labelMesh, wallObj });
}
function refreshAll2DLabels() {
  while (wall2DLabelGroup.children.length > 0) wall2DLabelGroup.remove(wall2DLabelGroup.children[0]);
  label2DObjects = [];
  walls.forEach(w => make2DLabel(w));
}
function update2DLabelVisibility() {
  label2DObjects.forEach(({ mesh }) => { mesh.visible = !is3D; });
}
const labelEditor = document.createElement('div');
labelEditor.style.cssText = 'display:none;position:fixed;z-index:500;background:#2a2a2a;border:2px solid #ff9500;border-radius:8px;padding:10px 12px;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.6);';
labelEditor.innerHTML = [
  '<span style="color:#aaa;font-size:12px;font-family:Arial">Length</span>',
  '<input id="label-editor-input" type="number" step="100" min="100" style="width:90px;background:#333;border:1px solid #ff9500;border-radius:6px;color:#fff;padding:6px 8px;font-size:14px;font-weight:bold;box-sizing:border-box"/>',
  '<span style="color:#aaa;font-size:12px;font-family:Arial">mm</span>',
  '<button id="label-editor-bt" style="background:none;border:1px solid #555;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:14px" title="Bluetooth measure">BT</button>',
  '<button id="label-editor-confirm" style="background:#ff9500;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;font-weight:bold">OK</button>',
  '<button id="label-editor-cancel" style="background:none;border:1px solid #555;color:#aaa;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px">X</button>'
].join('');
document.body.appendChild(labelEditor);

let labelEditorWall = null;

function showLabelEditor(wallObj, screenX, screenY) {
  labelEditorWall = wallObj;
  document.getElementById('label-editor-input').value = Math.round(wallObj.start.distanceTo(wallObj.end) * 1000);
  labelEditor.style.display = 'flex';
  let x = Math.max(10, Math.min(screenX - 100, window.innerWidth - 320));
  let y = Math.max(10, Math.min(screenY - 50, window.innerHeight - 80));
  labelEditor.style.left = x + 'px';
  labelEditor.style.top  = y + 'px';
  setTimeout(() => { const inp = document.getElementById('label-editor-input'); inp.focus(); inp.select(); }, 50);
}
function hideLabelEditor() {
  labelEditor.style.display = 'none';
  labelEditorWall = null;
}
document.getElementById('label-editor-confirm').addEventListener('click', () => {
  if (!labelEditorWall) return;
  const newLenM = mm(parseFloat(document.getElementById('label-editor-input').value));
  if (isNaN(newLenM) || newLenM < mm(50)) return;
  resizeLockedWall(labelEditorWall, newLenM);
  hideLabelEditor();
});
document.getElementById('label-editor-cancel').addEventListener('click', hideLabelEditor);
document.getElementById('label-editor-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('label-editor-confirm').click();
  if (e.key === 'Escape') hideLabelEditor();
});
document.getElementById('label-editor-bt').addEventListener('click', () => {
  alert('Bluetooth measurement coming soon.\nRequires Chrome on Android, Windows, or Mac.');
});

// ✅ FIX: GLTFLoader — actually used now
const gltfLoader = new GLTFLoader();

function loadProductModel(product, placeholderMesh) {
  if (!product.modelPath) return;
  gltfLoader.load(
    product.modelPath,
    (gltf) => {
      if (!placedItems.includes(placeholderMesh)) return;
      const model = gltf.scene;
      // Match placeholder position/rotation
      model.position.copy(placeholderMesh.position);
      model.rotation.copy(placeholderMesh.rotation);
      // Copy userData so quote/history still works
      model.userData = { ...placeholderMesh.userData };
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.userData = model.userData;
        }
      });
      scene.remove(placeholderMesh);
      placedItems = placedItems.filter(x => x !== placeholderMesh);
      scene.add(model);
      placedItems.push(model);
      // Update history entry so undo still removes the right object
      [undoStack, redoStack].forEach(stack => {
        stack.forEach(entry => {
          if (entry.type === 'add-item' && entry.data.mesh === placeholderMesh) {
            entry.data.mesh = model;
          }
        });
      });
    },
    undefined,
    (err) => console.warn('GLTF load failed for', product.modelPath, err)
  );
}

function buildWall(start, end, skipHistory = false) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < mm(50)) return null;
  const h = mm(settings.ceilingHeight), t = mm(settings.wallThickness);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, h, t),
    new THREE.MeshStandardMaterial({ color: 0xddd5c8 })
  );
  mesh.position.set((start.x + end.x) / 2, SLAB_H + h / 2, (start.z + end.z) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const wallObj = { mesh, start: start.clone(), end: end.clone(), capMeshes: [], label2D: null, baseColor: 0xddd5c8, opacity: 1 };
  mesh.userData.wallObj = wallObj;
 // REPLACE WITH:
  walls.push(wallObj);
  make2DLabel(wallObj);
  rebuildAllCaps();
  applyWallVisual(wallObj);   // respect X-ray / stored opacity on the new wall + caps
  // ✅ FIX: rebuild 2D overlay whenever a wall is added, not just on view toggle
  rebuild2DWallOverlays();
  update2DLabelVisibility();
  updateRoomArea();

  if (!skipHistory) pushHistory({ type: 'add-wall', data: { wallObj } });
  return wallObj;
}

const wall2DOverlayGroup = new THREE.Group();
wall2DOverlayGroup.name = 'wall2DOverlay';
scene.add(wall2DOverlayGroup);

// ✅ FIX: extracted into standalone function, called from buildWall, delete, undo/redo
function rebuild2DWallOverlays() {
  while (wall2DOverlayGroup.children.length > 0) wall2DOverlayGroup.remove(wall2DOverlayGroup.children[0]);
  if (is3D) return;
  walls.forEach(w => {
    const t = mm(settings.wallThickness);
    const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) return;
    const nx = dx / len, nz = dz / len;
    const px = -nz * t / 2, pz = nx * t / 2;
    const corners = [
      new THREE.Vector3(w.start.x + px, 0.04, w.start.z + pz),
      new THREE.Vector3(w.end.x   + px, 0.04, w.end.z   + pz),
      new THREE.Vector3(w.end.x   - px, 0.04, w.end.z   - pz),
      new THREE.Vector3(w.start.x - px, 0.04, w.start.z - pz),
      new THREE.Vector3(w.start.x + px, 0.04, w.start.z + pz),
    ];
    wall2DOverlayGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(corners),
      new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true })
    ));
  });
}

const wallPopup = document.createElement('div');
wallPopup.id = 'wall-edit-popup';
wallPopup.style.cssText = 'display:none;position:fixed;z-index:200;background:rgba(42,42,42,0.1);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid #ff9500;border-radius:10px;padding:16px;width:260px;font-family:Arial;font-size:13px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
wallPopup.innerHTML = [
  // ── Touch Quick Draw: drag handle (hidden on desktop via CSS/JS) ──────────
  '<div id="wp-drag-handle" style="display:none;align-items:center;gap:8px;',
  'background:rgba(255,149,0,0.1);border-radius:8px;padding:6px 8px;',
  'margin-bottom:8px;cursor:grab;touch-action:none;',
  'user-select:none;-webkit-user-select:none">',
  '<span style="color:rgba(255,255,255,0.3);font-size:17px;letter-spacing:-3px">⠿</span>',
  '<span id="wp-touch-label" style="flex:1;color:#ccc;font-size:12px;font-weight:bold"></span>',
  '</div>',

  // ── Title ─────────────────────────────────────────────────────────────────
  '<div style="color:#ff9500;font-weight:bold;margin-bottom:8px">Edit Wall</div>',

  // ── Length (always visible) ───────────────────────────────────────────────
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Length (mm)</label>',
  '<div style="display:flex;gap:6px;margin:4px 0 10px;align-items:center">',
  '<input id="wp-length" type="number" step="100" min="100" style="flex:1;background:#333;border:1px solid #ff9500;border-radius:6px;color:#fff;padding:8px 10px;font-size:15px;box-sizing:border-box"/>',
  '<button id="wp-bt" style="background:none;border:1px solid #555;border-radius:6px;padding:7px 9px;cursor:pointer;font-size:15px;touch-action:manipulation" title="Bluetooth">BT</button>',
  '<button id="wp-confirm" style="background:#ff9500;color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:bold;touch-action:manipulation">OK</button>',
  '</div>',

  // ── Anchor row ────────────────────────────────────────────────────────────
  '<div id="wp-fd-anchor-row" style="display:none;margin:-4px 0 10px">',
  '<button id="wp-fd-anchor" title="Switch which end stays locked when resizing" ',
  'style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:6px;',
  'padding:7px 8px;cursor:pointer;font-size:12px;touch-action:manipulation">⇄ Anchor: start</button>',
  '</div>',

  // ── Secondary section (thickness / height / type) ─────────────────────────
  // Hidden in compact touch mode; visible on desktop and in expanded touch mode
  '<div id="wp-secondary-section">',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Thickness (mm)</label>',
  '<div style="display:flex;gap:6px;margin:4px 0 10px;align-items:center">',
  '<input id="wp-thickness" type="number" step="10" min="50" max="500" style="flex:1;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:8px 10px;font-size:14px;box-sizing:border-box"/>',
  '<span style="color:#aaa;font-size:12px">mm</span>',
  '</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Ceiling Height</label>',
  '<select id="wp-height" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:7px 8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">',
  '<option value="2400">2400mm</option><option value="2700">2700mm</option>',
  '</select>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Type</label>',
  '<select id="wp-type" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:7px 8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">',
  '<option value="110">Interior 110mm</option><option value="150">Exterior 150mm</option>',
  '</select>',
  '</div>',

  // ── Actions (Delete / View Wall — always visible) ─────────────────────────
  '<div style="display:flex;gap:8px;margin-bottom:8px">',
  '<button id="wp-delete" style="flex:1;background:#c0392b;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;touch-action:manipulation">Delete</button>',
  '<button id="wp-view" style="flex:1;background:#2980b9;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;touch-action:manipulation">View Wall</button>',
  '</div>',

  // ── More-options toggle (touch Quick Draw only; hidden on desktop) ─────────
  '<button id="wp-more-btn" style="display:none;width:100%;background:none;',
  'border:1px solid #444;color:#888;border-radius:6px;padding:7px;font-size:12px;',
  'cursor:pointer;margin-bottom:6px;touch-action:manipulation">▸ More options</button>',

  // ── Advanced section (angle + openings) ───────────────────────────────────
  '<div id="wp-more-section">',
  '<hr style="border-color:#444;margin:2px 0 10px"/>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Angle (degrees)</label>',
  '<div style="display:flex;gap:6px;margin:4px 0 10px;align-items:center">',
  '<input id="wp-angle" type="number" step="1" min="-360" max="360" style="flex:1;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:8px 10px;font-size:14px;box-sizing:border-box"/>',
  '<span style="color:#aaa;font-size:12px">°</span>',
  '<button id="wp-angle-apply" style="background:#2980b9;color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:bold;touch-action:manipulation">Apply</button>',
  '</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Add Opening</label>',
  '<div style="display:flex;gap:8px;margin-top:4px">',
  '<button id="wp-door" style="flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:8px;cursor:pointer;font-size:12px;touch-action:manipulation">Door</button>',
  '<button id="wp-window" style="flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:8px;cursor:pointer;font-size:12px;touch-action:manipulation">Window</button>',
  '</div>',
  '</div>',

  // ── Close button (absolute, always) ───────────────────────────────────────
  '<button id="wp-close" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1;touch-action:manipulation">✕</button>',

  // ── Peek/hide button (touch Quick Draw only; hidden on desktop) ───────────
  '<button id="wp-peek-btn" style="display:none;position:absolute;top:10px;right:36px;',
  'background:none;border:1px solid #555;color:#aaa;border-radius:5px;',
  'font-size:13px;line-height:1;width:24px;height:24px;padding:0;cursor:pointer;',
  'touch-action:manipulation" title="Hide — tap handle to restore">–</button>',
].join('');
document.body.appendChild(wallPopup);

// ── Touch Quick Draw popup state ─────────────────────────
let _wpTQDragging  = false;      // pointer drag in progress
let _wpTQDragSX    = 0, _wpTQDragSY = 0;   // drag start pointer pos
let _wpTQPopLeft   = 20, _wpTQPopTop = 120; // current popup position
let _wpTQPeeked    = false;      // collapsed to drag-handle strip
let _wpTQMoreOpen  = false;      // advanced section expanded

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && wallPopup.style.display === 'block') document.getElementById('wp-confirm').click();
});

// ── Touch Quick Draw popup helpers ────────────────────────────────────────

function updateWallPopupTouchUI() {
  const isQT = IS_TOUCH && drawModeActive === 'quick';
  const handle  = document.getElementById('wp-drag-handle');
  const peekBtn = document.getElementById('wp-peek-btn');
  const moreBtn = document.getElementById('wp-more-btn');
  const secSec  = document.getElementById('wp-secondary-section');
  const moreSec = document.getElementById('wp-more-section');

  if (!isQT) {
    // Desktop / non-quick — show everything, hide touch-only controls
    handle.style.display  = 'none';
    peekBtn.style.display = 'none';
    moreBtn.style.display = 'none';
    secSec.style.display  = '';
    moreSec.style.display = '';
    wallPopup.classList.remove('wep-tq', 'wep-peeked');
    // 10% glass background on all contexts
    wallPopup.style.background = IS_TOUCH ? 'rgba(42,42,42,0.1)' : 'rgba(42,42,42,0.1)';
    wallPopup.style.backdropFilter = 'blur(18px)';
    wallPopup.style.webkitBackdropFilter = 'blur(18px)';
    return;
  }

  // Touch Quick Draw mode
  wallPopup.classList.add('wep-tq');
  wallPopup.style.background = 'rgba(20,20,20,0.5)';
  handle.style.display  = 'flex';
  peekBtn.style.display = '';
  moreBtn.style.display = '';
  // Anchor row is not useful mid-draw — keep it hidden in Quick Draw
  document.getElementById('wp-fd-anchor-row').style.display = 'none';

  if (_wpTQPeeked) {
    wallPopup.classList.add('wep-peeked');
    // CSS hides everything except handle + absolute buttons
  } else {
    wallPopup.classList.remove('wep-peeked');
    // Secondary (thickness/height/type) + advanced (angle/openings) both
    // live behind ▸ More options so the default view is minimal
    secSec.style.display  = _wpTQMoreOpen ? '' : 'none';
    moreSec.style.display = _wpTQMoreOpen ? '' : 'none';
  }

  peekBtn.textContent = _wpTQPeeked ? '+' : '–';
  peekBtn.title       = _wpTQPeeked ? 'Restore' : 'Hide — tap grip to restore';
  moreBtn.textContent = _wpTQMoreOpen ? '▴ Less' : '▸ More options';
}

function _wpTQSetPos(left, top) {
  const popW = wallPopup.offsetWidth  || 200;
  const popH = wallPopup.offsetHeight || 130;
  _wpTQPopLeft = Math.max(4, Math.min(window.innerWidth  - popW - 4, left));
  _wpTQPopTop  = Math.max(56, Math.min(window.innerHeight - popH - 8, top));
  wallPopup.style.left = _wpTQPopLeft + 'px';
  wallPopup.style.top  = _wpTQPopTop  + 'px';
}

function initWallPopupTouch() {
  const handle  = document.getElementById('wp-drag-handle');
  const peekBtn = document.getElementById('wp-peek-btn');
  const moreBtn = document.getElementById('wp-more-btn');

  // ── Drag by handle ──────────────────────────────────────
  handle.addEventListener('pointerdown', (e) => {
    if (_wpTQPeeked) {
      // Tapping handle when peeked restores the popup
      _wpTQPeeked = false;
      updateWallPopupTouchUI();
      return;
    }
    e.preventDefault();
    _wpTQDragging = true;
    _wpTQDragSX = e.clientX - _wpTQPopLeft;
    _wpTQDragSY = e.clientY - _wpTQPopTop;
    handle.setPointerCapture(e.pointerId);
    wallPopup.style.cursor = 'grabbing';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!_wpTQDragging) return;
    _wpTQSetPos(e.clientX - _wpTQDragSX, e.clientY - _wpTQDragSY);
  });
  const _endWPDrag = () => {
    if (!_wpTQDragging) return;
    _wpTQDragging = false;
    wallPopup.style.cursor = '';
  };
  handle.addEventListener('pointerup',     _endWPDrag);
  handle.addEventListener('pointercancel', _endWPDrag);

  // ── Peek / restore ──────────────────────────────────────
  peekBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _wpTQPeeked = !_wpTQPeeked;
    updateWallPopupTouchUI();
  });

  // ── More / less toggle ──────────────────────────────────
  moreBtn.addEventListener('click', () => {
    _wpTQMoreOpen = !_wpTQMoreOpen;
    updateWallPopupTouchUI();
  });
}

function showWallPopup(wallObj, sx, sy) {
  selectedWall = wallObj;
  document.getElementById('wp-length').value    = Math.round(wallObj.start.distanceTo(wallObj.end) * 1000);
  document.getElementById('wp-height').value    = settings.ceilingHeight;
  document.getElementById('wp-type').value      = settings.wallThickness;
  document.getElementById('wp-thickness').value = settings.wallThickness;
  const wallAngleRad = Math.atan2(
    wallObj.end.x - wallObj.start.x,
    wallObj.end.z - wallObj.start.z
  );
  document.getElementById('wp-angle').value = Math.round(THREE.MathUtils.radToDeg(wallAngleRad));

  if (IS_TOUCH && drawModeActive === 'quick') {
    // ── Compact floating panel for Quick Draw (draggable, semi-transparent) ──
    wallPopup.style.transform     = '';
    wallPopup.style.bottom        = '';
    wallPopup.style.width         = '200px';
    wallPopup.style.maxHeight     = '90dvh';
    wallPopup.style.overflowY     = 'auto';
    wallPopup.style.borderRadius  = '12px';
    wallPopup.style.padding       = '8px 10px 10px';
    // Position near tap, clamped so it doesn't go off screen
    const popW = 200, popH = _wpTQMoreOpen ? 280 : 130;
    let px = sx - popW / 2;
    let py = sy - popH - 20;
    // Prefer below if above would clip
    if (py < 60) py = sy + 20;
    _wpTQPopLeft = Math.max(4, Math.min(window.innerWidth  - popW - 4, px));
    _wpTQPopTop  = Math.max(56, Math.min(window.innerHeight - popH - 8, py));
    wallPopup.style.left = _wpTQPopLeft + 'px';
    wallPopup.style.top  = _wpTQPopTop  + 'px';
    // Update label with wall length
    const lenMm = Math.round(wallObj.start.distanceTo(wallObj.end) * 1000);
    document.getElementById('wp-touch-label').textContent = lenMm + ' mm';
    // Reset peek on new wall selection
    _wpTQPeeked = false;
  } else if (IS_TOUCH) {
    // ── Bottom sheet for Select mode / other touch contexts ──────────────────
    wallPopup.style.left          = '50%';
    wallPopup.style.transform     = 'translateX(-50%)';
    wallPopup.style.top           = '';
    wallPopup.style.bottom        = '0';
    wallPopup.style.width         = 'min(440px, 100vw)';
    wallPopup.style.maxHeight     = '82dvh';
    wallPopup.style.overflowY     = 'auto';
    wallPopup.style.borderRadius  = '14px 14px 0 0';
    wallPopup.style.padding       = '16px';   // restore base padding (compact mode overwrites the shorthand)
    wallPopup.style.paddingBottom = 'calc(16px + env(safe-area-inset-bottom, 0px))';
  } else {
    // ── Desktop: positioned near click ───────────────────────────────────────
    const pw = 260, ph = 420;
    let x = sx + 15, y = sy - 10;
    if (x + pw > window.innerWidth)  x = sx - pw - 15;
    if (y + ph > window.innerHeight) y = window.innerHeight - ph - 10;
    wallPopup.style.left = x + 'px'; wallPopup.style.top = y + 'px';
    wallPopup.style.transform = ''; wallPopup.style.bottom = '';
    wallPopup.style.width = '260px'; wallPopup.style.maxHeight = '';
    wallPopup.style.overflowY = ''; wallPopup.style.borderRadius = '10px';
    wallPopup.style.padding = '16px';   // restore base padding (compact mode overwrites the shorthand)
  }
  updateWallPopupTouchUI();
  wallPopup.style.display = 'block';
  walls.forEach(w => w.mesh.material.color.set(wallBaseColor(w)));
  wallObj.mesh.material.color.set(0xff9500);
  // Desktop only: auto-select length for quick typing. On touch this would pop
  // the on-screen keyboard over the scene on every wall tap.
  if (!IS_TOUCH) setTimeout(() => document.getElementById('wp-length').select(), 50);
  showWallHandles(wallObj);

  // Anchor toggle: Free Draw keeps its own state; Select mode (Task B) gets the
  // same control wired to selAnchor + the parametric rescale. Handles colour
  // green = locked end, white = moving end.
  const anchorRow = document.getElementById('wp-fd-anchor-row');
  if (mode === 'draw-free' && fdSel === wallObj) {
    anchorRow.style.display = 'block';
    document.getElementById('wp-fd-anchor').textContent = '⇄ Anchor: ' + fdAnchor;
    fdHandleColors();
  } else if (mode === 'select') {
    selAnchor = 'start';                       // reset per wall selection
    anchorRow.style.display = 'block';
    document.getElementById('wp-fd-anchor').textContent = '⇄ Anchor: ' + selAnchor;
    colorWallHandles(selAnchor);
  } else {
    anchorRow.style.display = 'none';
  }

  // Show dimension label on screen
  const wallMid = new THREE.Vector3(
    (wallObj.start.x + wallObj.end.x) / 2,
    0,
    (wallObj.start.z + wallObj.end.z) / 2
  );
  const wallScreenPos = wallMid.clone().project(activeCamera);
  const wallSx = (wallScreenPos.x *  0.5 + 0.5) * window.innerWidth;
  const wallSy = (wallScreenPos.y * -0.5 + 0.5) * window.innerHeight;
  const wallLenMm = Math.round(wallObj.start.distanceTo(wallObj.end) * 1000);
  dimLabel.textContent = wallLenMm + ' mm';
  dimLabel.style.left = (wallSx - 50) + 'px';
  dimLabel.style.top  = (wallSy - 60) + 'px';
  dimLabel.style.display = 'block';


  
}
function hideWallPopup() {
  wallPopup.style.display = 'none';
  wallPopup.classList.remove('wep-tq', 'wep-peeked');
  wallPopup.style.background = 'rgba(42,42,42,0.1)';
  wallPopup.style.backdropFilter = 'blur(18px)';
  wallPopup.style.webkitBackdropFilter = 'blur(18px)';
  wallPopup.style.padding = '';  // reset compact-mode padding
  _wpTQPeeked = false;
  clearWallHandles();
  dimLabel.style.display = 'none';
  walls.forEach(w => w.mesh.material.color.set(wallBaseColor(w)));
  selectedWall = null; hoveredWall = null;
  // In Free Draw mode the popup serves as the fd selection popup — clear that state too.
  if (mode === 'draw-free') { fdSel = null; fdDragging = false; fdLastNs = fdLastNe = null; }
}

// ── Task C: multi-select walls (Ctrl/Cmd + left-click, Select mode) ──────────
function toggleWallMultiSelect(w) {
  if (selectedWalls.includes(w)) {
    selectedWalls = selectedWalls.filter(x => x !== w);
    w.mesh.material.color.set(wallBaseColor(w));
  } else {
    selectedWalls.push(w);
    w.mesh.material.color.set(WALL_MULTI_COLOR);
  }
}
function clearWallMultiSelect() {
  if (!selectedWalls.length) return;
  const prev = selectedWalls;
  selectedWalls = [];
  prev.forEach(w => { if (walls.includes(w)) w.mesh.material.color.set(wallBaseColor(w)); });
}

// ── Cabinet selection: cyan wireframe box + multi-select (Select mode) ───────
let selectedCabinets = [];                 // multi-selected cabinet roots (placedItems)
const cabinetBoxHelpers = new Map();       // model -> THREE.BoxHelper

function addCabinetBox(model) {
  if (cabinetBoxHelpers.has(model)) return;
  const helper = new THREE.BoxHelper(model, WALL_MULTI_COLOR);
  if (helper.material) { helper.material.depthTest = false; helper.material.transparent = true; }
  helper.renderOrder = 999;
  scene.add(helper);
  cabinetBoxHelpers.set(model, helper);
}
function removeCabinetBox(model) {
  const helper = cabinetBoxHelpers.get(model);
  if (!helper) return;
  scene.remove(helper);
  if (helper.geometry) helper.geometry.dispose();
  if (helper.material) helper.material.dispose();
  cabinetBoxHelpers.delete(model);
}
function clearCabinetSelection() {
  if (!selectedCabinets.length) return;
  selectedCabinets.slice().forEach(removeCabinetBox);
  selectedCabinets = [];
}
function selectCabinet(model, additive) {
  if (additive) {
    if (selectedCabinets.includes(model)) {
      selectedCabinets = selectedCabinets.filter(m => m !== model);
      removeCabinetBox(model);
    } else {
      selectedCabinets.push(model);
      addCabinetBox(model);
    }
    return;
  }
  if (selectedCabinets.length === 1 && selectedCabinets[0] === model) return;  // already the sole selection
  clearCabinetSelection();
  selectedCabinets.push(model);
  addCabinetBox(model);
}
// Drop a deleted cabinet from the selection + dispose its box.
function deselectCabinet(model) {
  if (cabinetBoxHelpers.has(model)) removeCabinetBox(model);
  selectedCabinets = selectedCabinets.filter(m => m !== model);
}
function updateCabinetBoxes() {
  if (!selectedCabinets.length) return;
  selectedCabinets.forEach(m => { const h = cabinetBoxHelpers.get(m); if (h) h.update(); });
}

// ── Wall style (Task D): per-wall base colour + opacity ─────────────────────
// The hover/selection code temporarily overrides .color, so we track each wall's
// own "base" colour and restore to that (not a hardcoded default).
function wallBaseColor(w) {
  return (w && w.baseColor != null) ? w.baseColor : 0xddd5c8;
}
// Apply a wall's stored base colour + opacity to its live material (+ owned caps).
// While X-ray is on, opacity is forced low (view only — stored opacity is untouched).
function applyWallVisual(w) {
  if (!w || !w.mesh || !w.mesh.material) return;
  const stored = (w.opacity != null) ? w.opacity : 1;
  const op = wallXray ? XRAY_OPACITY : stored;
  w.mesh.material.color.set(wallBaseColor(w));
  w.mesh.material.transparent = op < 1;
  w.mesh.material.opacity = op;
  w.mesh.material.needsUpdate = true;
  // Corner caps this wall owns share its colour/opacity (live feedback).
  if (w.capMeshes) w.capMeshes.forEach(c => {
    if (!c.material) return;
    c.material.color.set(wallBaseColor(w));
    c.material.transparent = op < 1;
    c.material.opacity = op;
    c.material.needsUpdate = true;
  });
}

// Copy stored colour/opacity from one wall onto another (used when walls are rebuilt).
function carryWallStyle(src, dst) {
  if (!src || !dst) return;
  dst.baseColor = (src.baseColor != null) ? src.baseColor : 0xddd5c8;
  dst.opacity   = (src.opacity   != null) ? src.opacity   : 1;
  applyWallVisual(dst);
}

// ── Wall Style popup (Task D): right-click a wall → colour + opacity ─────────
const wallStylePopup = document.createElement('div');
wallStylePopup.id = 'wall-style-popup';
wallStylePopup.style.cssText = 'display:none;position:fixed;z-index:210;background:#2a2a2a;border:1px solid #00bcd4;border-radius:10px;padding:14px;width:220px;font-family:Arial;font-size:13px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
const WALL_SWATCHES = ['#ddd5c8','#ffffff','#c8d8e8','#d8e8c8','#e8c8c8','#9aa0a6','#444444','#1a1a1a'];
wallStylePopup.innerHTML = [
  '<div style="color:#00bcd4;font-weight:bold;margin-bottom:10px">Wall Style <span id="wsp-count" style="color:#888;font-weight:normal;font-size:11px"></span></div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Colour</label>',
  '<div id="wsp-swatches" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px"></div>',
  '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">',
  '<input id="wsp-color" type="color" value="#ddd5c8" style="width:40px;height:30px;border:none;background:none;cursor:pointer"/>',
  '<span style="color:#aaa;font-size:12px">Custom</span>',
  '</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Opacity <span id="wsp-op-val">100%</span></label>',
  '<input id="wsp-opacity" type="range" min="10" max="100" value="100" style="width:100%;margin:6px 0 12px"/>',
  '<button id="wsp-done" style="width:100%;background:#00bcd4;color:#fff;border:none;border-radius:6px;padding:8px;cursor:pointer;font-weight:bold">Done</button>',
  '<button id="wsp-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">×</button>',
].join('');
document.body.appendChild(wallStylePopup);
['click','mousedown','contextmenu','pointerdown'].forEach(ev =>
  wallStylePopup.addEventListener(ev, e => e.stopPropagation()));

let styleTargetWalls = [];          // walls being edited by the popup
let styleBefore      = [];          // [{ wall, color, opacity }] snapshot for undo

function wspHexToInt(hex) { return parseInt(hex.replace('#',''), 16); }
function wspIntToHex(n)  { return '#' + ('000000' + ((n>>>0) & 0xffffff).toString(16)).slice(-6); }

function applyWallStyleLive() {
  const colInt = wspHexToInt(document.getElementById('wsp-color').value);
  const op = parseInt(document.getElementById('wsp-opacity').value, 10) / 100;
  document.getElementById('wsp-op-val').textContent = Math.round(op * 100) + '%';
  styleTargetWalls.forEach(w => { w.baseColor = colInt; w.opacity = op; applyWallVisual(w); });
}

function openWallStylePopup(clickedWall, sx, sy) {
  const set = new Set([clickedWall, ...selectedWalls]);
  styleTargetWalls = [...set].filter(w => walls.includes(w));
  if (!styleTargetWalls.length) return;
  styleBefore = styleTargetWalls.map(w => ({ wall: w, color: wallBaseColor(w), opacity: (w.opacity != null ? w.opacity : 1) }));

  document.getElementById('wsp-color').value     = wspIntToHex(wallBaseColor(clickedWall));
  document.getElementById('wsp-opacity').value   = Math.round((clickedWall.opacity != null ? clickedWall.opacity : 1) * 100);
  document.getElementById('wsp-op-val').textContent = document.getElementById('wsp-opacity').value + '%';
  document.getElementById('wsp-count').textContent  = styleTargetWalls.length > 1 ? '(' + styleTargetWalls.length + ' walls)' : '';

  if (IS_TOUCH) {
    wallStylePopup.style.left          = '50%';
    wallStylePopup.style.transform     = 'translateX(-50%)';
    wallStylePopup.style.top           = '';
    wallStylePopup.style.bottom        = '0';
    wallStylePopup.style.width         = 'min(360px, 100vw)';
    wallStylePopup.style.borderRadius  = '14px 14px 0 0';
    wallStylePopup.style.paddingBottom = 'calc(14px + env(safe-area-inset-bottom, 0px))';
  } else {
    const pw = 220, ph = 250;
    let x = sx + 12, y = sy + 12;
    if (x + pw > window.innerWidth)  x = window.innerWidth  - pw - 10;
    if (y + ph > window.innerHeight) y = window.innerHeight - ph - 10;
    wallStylePopup.style.left = x + 'px'; wallStylePopup.style.top = y + 'px';
    wallStylePopup.style.transform = ''; wallStylePopup.style.bottom = '';
    wallStylePopup.style.width = '220px'; wallStylePopup.style.borderRadius = '10px';
    wallStylePopup.style.paddingBottom = '14px';
  }
  wallStylePopup.style.display = 'block';
}

function closeWallStylePopup() {
  if (wallStylePopup.style.display !== 'block') return;
  wallStylePopup.style.display = 'none';
  const items = [];
  styleBefore.forEach(b => {
    if (!walls.includes(b.wall)) return;
    const after = { color: wallBaseColor(b.wall), opacity: (b.wall.opacity != null ? b.wall.opacity : 1) };
    if (after.color !== b.color || after.opacity !== b.opacity)
      items.push({ wall: b.wall, before: { color: b.color, opacity: b.opacity }, after });
  });
  if (items.length) pushHistory({ type: 'style-walls', data: { items } });
  styleTargetWalls = [];
  styleBefore = [];
  rebuildAllCaps();   // normalise shared corner caps to their owner wall's style
  // Live styling overrode the cyan highlight — re-assert it for still-selected walls.
  selectedWalls.forEach(w => { if (walls.includes(w)) w.mesh.material.color.set(WALL_MULTI_COLOR); });
}

const wspSwatchWrap = wallStylePopup.querySelector('#wsp-swatches');
WALL_SWATCHES.forEach(hex => {
  const s = document.createElement('button');
  s.title = hex;
  s.style.cssText = 'width:24px;height:24px;border-radius:5px;border:1px solid #555;cursor:pointer;padding:0;background:' + hex;
  s.addEventListener('click', () => { document.getElementById('wsp-color').value = hex; applyWallStyleLive(); });
  wspSwatchWrap.appendChild(s);
});
document.getElementById('wsp-color').addEventListener('input', applyWallStyleLive);
document.getElementById('wsp-opacity').addEventListener('input', applyWallStyleLive);
document.getElementById('wsp-done').addEventListener('click', closeWallStylePopup);
document.getElementById('wsp-close').addEventListener('click', closeWallStylePopup);

// ── Task E: global X-ray (see-through walls) toggle — view only, not persisted ─
function setWallXray(on) {
  wallXray = !!on;
  walls.forEach(w => {
    if (!w.mesh || !w.mesh.material) return;
    const op = wallXray ? XRAY_OPACITY : ((w.opacity != null) ? w.opacity : 1);
    w.mesh.material.transparent = op < 1;
    w.mesh.material.opacity = op;
    w.mesh.material.needsUpdate = true;
    if (w.capMeshes) w.capMeshes.forEach(c => {
      if (!c.material) return;
      c.material.transparent = op < 1;
      c.material.opacity = op;
      c.material.needsUpdate = true;
    });
  });
  const btn = document.getElementById('btn-wall-xray');
  if (btn) btn.classList.toggle('active', wallXray);
}
// X-ray toggled via hamburger menu (#hmenu-wall-xray → setWallXray)

document.getElementById('wp-confirm').addEventListener('click', () => {
  if (!selectedWall) return;
  const newLenM  = mm(parseFloat(document.getElementById('wp-length').value));
  const newThick = parseInt(document.getElementById('wp-thickness').value);
  settings.ceilingHeight = parseInt(document.getElementById('wp-height').value);
  settings.wallThickness = parseInt(document.getElementById('wp-type').value) || newThick;
  // Free Draw: resize keeping the chosen anchor end fixed (angle preserved).
  if (mode === 'draw-free' && fdSel === selectedWall && newLenM > 0) {
    const anchor = (fdAnchor === 'start' ? fdSel.start : fdSel.end).clone();
    const moving = (fdAnchor === 'start' ? fdSel.end   : fdSel.start).clone();
    const dir    = new THREE.Vector3().subVectors(moving, anchor).normalize();
    const newMov = anchor.clone().addScaledVector(dir, newLenM);
    const ns = fdAnchor === 'start' ? anchor : newMov;
    const ne = fdAnchor === 'start' ? newMov : anchor;
    fdSel = fdReplaceWall(fdSel, ns, ne);
    hideWallPopup();
    return;
  }
  resizeLockedWall(selectedWall, newLenM, selAnchor);   // Task B: honour chosen anchor
  hideWallPopup();
});
document.getElementById('wp-bt').addEventListener('click', () => {
  alert('Bluetooth measurement coming soon.\nRequires Chrome on Android, Windows, or Mac.');
});
document.getElementById('wp-delete').addEventListener('click', () => {
  if (!selectedWall) return;
  pushHistory({ type: 'delete-wall', data: { wallObj: selectedWall } });
  scene.remove(selectedWall.mesh);
  if (selectedWall.capMeshes) selectedWall.capMeshes.forEach(c => scene.remove(c));
  if (selectedWall.label2D) wall2DLabelGroup.remove(selectedWall.label2D);
  clearWallOpeningMeshes(selectedWall);
  walls = walls.filter(w => w !== selectedWall);
  rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
  updateRoomArea();
});
document.getElementById('wp-close').addEventListener('click', hideWallPopup);
document.getElementById('wp-fd-anchor').addEventListener('click', () => {
  if (fdSel) {                                 // Free Draw branch — unchanged
    fdAnchor = fdAnchor === 'start' ? 'end' : 'start';
    document.getElementById('wp-fd-anchor').textContent = '⇄ Anchor: ' + fdAnchor;
    fdHandleColors();
    return;
  }
  // Task B: Select mode — toggle which end the parametric rescale keeps fixed.
  if (mode === 'select' && selectedWall) {
    selAnchor = selAnchor === 'start' ? 'end' : 'start';
    document.getElementById('wp-fd-anchor').textContent = '⇄ Anchor: ' + selAnchor;
    colorWallHandles(selAnchor);
  }
});
document.getElementById('wp-angle-apply').addEventListener('click', () => {
  if (!selectedWall) return;
  const deg = parseFloat(document.getElementById('wp-angle').value);
  if (isNaN(deg)) return;
  const rad = THREE.MathUtils.degToRad(deg);
  const len = selectedWall.start.distanceTo(selectedWall.end);
  const newEnd = new THREE.Vector3(
    selectedWall.start.x + Math.sin(rad) * len,
    0,
    selectedWall.start.z + Math.cos(rad) * len
  );
  selectedWall.end.copy(newEnd);
  scene.remove(selectedWall.mesh);
  const dx = newEnd.x - selectedWall.start.x;
  const dz = newEnd.z - selectedWall.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const h = mm(settings.ceilingHeight), t = mm(settings.wallThickness);
  selectedWall.mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, h, t),
    new THREE.MeshStandardMaterial({ color: 0xff9500 })
  );
  selectedWall.mesh.position.set(
    (selectedWall.start.x + newEnd.x) / 2, h / 2,
    (selectedWall.start.z + newEnd.z) / 2
  );
  selectedWall.mesh.rotation.y = -Math.atan2(dz, dx);
  selectedWall.mesh.castShadow = selectedWall.mesh.receiveShadow = true;
  selectedWall.mesh.userData.wallObj = selectedWall;
  // Preserve stored opacity on the freshly-built mesh (colour reverts on deselect).
  { const _op = (selectedWall.opacity != null) ? selectedWall.opacity : 1;
    selectedWall.mesh.material.transparent = _op < 1;
    selectedWall.mesh.material.opacity = _op; }
  scene.add(selectedWall.mesh);
  rebuildAllCaps();
  refreshAll2DLabels();
  rebuild2DWallOverlays();
  updateRoomArea();
  hideWallPopup();
});

document.getElementById('wp-door').addEventListener('click', () => { if (selectedWall) addOpening(selectedWall, 'door'); hideWallPopup(); });
document.getElementById('wp-window').addEventListener('click', () => { if (selectedWall) addOpening(selectedWall, 'window'); hideWallPopup(); });
document.getElementById('wp-view').addEventListener('click', () => { if (selectedWall) openWallElevation(selectedWall); hideWallPopup(); });

// Initialise touch Quick Draw popup controls (once)
initWallPopupTouch();

// --- Elevation panel (unchanged from original) ---
const elevationPanel = document.createElement('div');
elevationPanel.id = 'elevation-panel';
elevationPanel.style.cssText = 'display:none;position:fixed;top:0;right:0;width:520px;height:100vh;background:#1e1e1e;border-left:2px solid #ff9500;z-index:600;font-family:Arial;flex-direction:column;overflow:hidden;';
elevationPanel.innerHTML = [
  '<div style="background:#2a2a2a;padding:14px 16px;border-bottom:1px solid #333;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">',
  '<div>',
  '<span style="color:#ff9500;font-weight:bold;font-size:15px">Wall Elevation</span>',
  '<span id="elev-wall-label" style="color:#888;font-size:11px;margin-left:10px"></span>',
  '</div>',
  '<div style="display:flex;gap:8px;align-items:center">',
  '<button id="elev-add-door" style="background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">＋ Door</button>',
  '<button id="elev-add-window" style="background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">＋ Window</button>',
  '<button id="elev-close" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;padding:0 4px" title="Close (Esc)">✕</button>',
  '</div></div>',
  '<div style="padding:8px 16px;border-bottom:1px solid #222;flex-shrink:0;display:flex;align-items:center;justify-content:space-between">',
  '<span id="elev-wall-info" style="color:#aaa;font-size:12px"></span>',
  '<span style="color:#555;font-size:11px">Drag openings · Click to edit</span>',
  '</div>',
  '<canvas id="elev-canvas" style="flex:1;width:100%;cursor:crosshair;display:block;min-height:0"></canvas>',
  '<div id="elev-opening-editor" style="display:none;padding:14px 16px;background:#252525;border-top:2px solid #ff9500;flex-shrink:0;font-size:13px;color:#fff">',
  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">',
  '<span style="color:#ff9500;font-weight:bold;font-size:13px" id="elev-editor-title">Edit Opening</span>',
  '<div style="display:flex;gap:6px">',
  '<button id="elev-center-opening" style="background:#333;color:#aaa;border:1px solid #555;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:11px">⊕ Center</button>',
  '<button id="elev-editor-cancel" style="background:none;border:1px solid #555;color:#aaa;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:13px">✕</button>',
  '</div></div>',
  '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">',
  '<div><label style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:.5px">Width mm</label><input id="elev-width" type="number" step="50" min="100" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:6px 7px;font-size:13px;box-sizing:border-box;margin-top:3px"/></div>',
  '<div><label style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:.5px">Height mm</label><input id="elev-height" type="number" step="50" min="100" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:6px 7px;font-size:13px;box-sizing:border-box;margin-top:3px"/></div>',
  '<div><label style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:.5px">From left mm</label><input id="elev-dist" type="number" step="50" min="0" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:6px 7px;font-size:13px;box-sizing:border-box;margin-top:3px"/></div>',
  '<div><label style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:.5px">From floor mm</label><input id="elev-floor-dist" type="number" step="50" min="0" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:6px 7px;font-size:13px;box-sizing:border-box;margin-top:3px"/></div>',
  '</div>',
  '<div style="display:flex;gap:8px">',
  '<button id="elev-apply" style="flex:1;background:#ff9500;color:#fff;border:none;border-radius:6px;padding:8px;cursor:pointer;font-size:13px;font-weight:bold">Apply</button>',
  '<button id="elev-delete-opening" style="flex:1;background:#c0392b;color:#fff;border:none;border-radius:6px;padding:8px;cursor:pointer;font-size:13px">Delete</button>',
  '</div></div>'
].join('');
document.body.appendChild(elevationPanel);

let elevWall = null, elevOpenings = [], elevCabinets = [], selectedOpening = null;
// ── Unified elevation selection (opening OR cabinet) ──────────────
let elevSelectedKind = null;   // 'opening' | 'cabinet' | null
let elevSelectedItem = null;   // the selected op or cabinet object
let elevDragOp = null, elevDragOffsetMm = 0, elevHoveredOp = null, elevHoveredCab = null;
// ── Elevation zoom / pan state (touch pinch) ──────────────
let elevZoom = 1, elevPanX = 0, elevPanY = 0;
let _elevPinchActive = false, _elevPinchDist0 = 1;
let _elevPinchZoom0 = 1, _elevPinchPanX0 = 0, _elevPinchPanY0 = 0;
let _elevPinchCx0 = 0, _elevPinchCy0 = 0, _elevPinchJustEnded = false;

const elevCanvas = document.getElementById('elev-canvas');
const elevCtx = elevCanvas.getContext('2d');

// ── Zoom controls (− / + always visible, reset shows when zoomed) ─────────
function elevZoomBy(f) {
  const z0 = elevZoom;
  const z1 = Math.max(0.4, Math.min(6, z0 * f));
  if (z1 === z0) return;
  // Anchor zoom at the canvas centre so content stays in view
  const ax = elevCanvas.width / 2, ay = elevCanvas.height / 2;
  elevPanX = ax - ((ax - elevPanX) / z0) * z1;
  elevPanY = ay - ((ay - elevPanY) / z0) * z1;
  elevZoom = z1;
  if (elevWall) drawElevation();
}

{
  const _zbCss = 'background:none;border:1px solid #555;color:#aaa;border-radius:5px;' +
    'padding:3px 9px;font-size:13px;cursor:pointer;' +
    'touch-action:manipulation;min-height:36px;min-width:36px';
  const header = elevationPanel.querySelector('#elev-wall-info').parentElement;

  const _zOut = document.createElement('button');
  _zOut.id = 'elev-zoom-out'; _zOut.title = 'Zoom out';
  _zOut.style.cssText = _zbCss; _zOut.textContent = '−';
  _zOut.addEventListener('click', () => elevZoomBy(1 / 1.3));
  header.appendChild(_zOut);

  const _zIn = document.createElement('button');
  _zIn.id = 'elev-zoom-in'; _zIn.title = 'Zoom in';
  _zIn.style.cssText = _zbCss; _zIn.textContent = '+';
  _zIn.addEventListener('click', () => elevZoomBy(1.3));
  header.appendChild(_zIn);

  const _zb = document.createElement('button');
  _zb.id = 'elev-zoom-reset';
  _zb.title = 'Reset zoom';
  _zb.style.cssText = _zbCss + ';display:none;font-size:11px';
  _zb.textContent = '1×';
  _zb.addEventListener('click', () => {
    elevZoom = 1; elevPanX = 0; elevPanY = 0;
    if (elevWall) drawElevation();
  });
  header.appendChild(_zb);
}

// Desktop: mouse-wheel zoom anchored at the cursor
elevCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const z0 = elevZoom;
  const z1 = Math.max(0.4, Math.min(6, z0 * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  if (z1 === z0) return;
  const rect = elevCanvas.getBoundingClientRect();
  const ax = e.clientX - rect.left, ay = e.clientY - rect.top;
  elevPanX = ax - ((ax - elevPanX) / z0) * z1;
  elevPanY = ay - ((ay - elevPanY) / z0) * z1;
  elevZoom = z1;
  if (elevWall) drawElevation();
}, { passive: false });

function getElevDrawInfo() {
  const W = elevCanvas.width, H = elevCanvas.height;
  if (!elevWall || W === 0 || H === 0) return null;
  const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
  const wallHMm   = settings.ceilingHeight;
  const padL = 72, padR = 36, padT = 36, padB = 76;
  const drawW = W - padL - padR, drawH = H - padT - padB;
  const scale   = Math.min(drawW / wallLenMm, drawH / wallHMm);
  const scaledW = wallLenMm * scale, scaledH = wallHMm * scale;
  const ox = padL + (drawW - scaledW) / 2;
  const oy = padT + (drawH - scaledH) / 2;
  return { W, H, ox, oy, drawW: scaledW, drawH: scaledH, scale, wallLenMm, wallHMm };
}

function openingHitTest(cx, cy, info) {
  const { ox, oy, drawH, scale } = info;
  for (let i = elevOpenings.length - 1; i >= 0; i--) {
    const op = elevOpenings[i];
    const rx = ox + op.distFromLeft * scale;
    const rw = op.width  * scale;
    const rh = op.height * scale;
    const ry = oy + drawH - op.floorDist * scale - rh;
    if (cx >= rx - 4 && cx <= rx + rw + 4 && cy >= ry - 4 && cy <= ry + rh + 4) return op;
  }
  return null;
}

function cabinetHitTest(cx, cy, info) {
  const { ox, oy, drawH, scale } = info;
  for (let i = elevCabinets.length - 1; i >= 0; i--) {
    const cab = elevCabinets[i];
    const rx = ox + cab.distFromLeft * scale;
    const rw = cab.width  * scale;
    const rh = cab.height * scale;
    const ry = oy + drawH - cab.floorDist * scale - rh;
    if (cx >= rx - 4 && cx <= rx + rw + 4 && cy >= ry - 4 && cy <= ry + rh + 4) return cab;
  }
  return null;
}

function rulerStepMm(totalMm, scale) {
  const candidates = [50, 100, 200, 250, 500, 1000, 2000];
  for (const c of candidates) {
    const tickCount = totalMm / c;
    const tickPx    = c * scale;
    if (tickPx >= 18 && tickCount <= 20) return c;
  }
  return 1000;
}

function drawArrow(ctx, x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size,  size * 0.38);
  ctx.lineTo(size, -size * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDimLine(ctx, x1, y1, x2, y2, label, vertical = false) {
  ctx.save();
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ar = 5;
  ctx.beginPath();
  if (!vertical) {
    ctx.moveTo(x1, y1 - 4); ctx.lineTo(x1, y1 + 4);
    ctx.moveTo(x2, y2 - 4); ctx.lineTo(x2, y2 + 4);
    ctx.moveTo(x1 + ar, y1); ctx.lineTo(x2 - ar, y2);
    ctx.stroke();
    drawArrow(ctx, x1, y1, 0,       ar);
    drawArrow(ctx, x2, y2, Math.PI, ar);
  } else {
    ctx.moveTo(x1 - 4, y1); ctx.lineTo(x1 + 4, y1);
    ctx.moveTo(x2 - 4, y2); ctx.lineTo(x2 + 4, y2);
    ctx.moveTo(x1, y1 + ar); ctx.lineTo(x2, y2 - ar);
    ctx.stroke();
    drawArrow(ctx, x1, y1,  Math.PI / 2, ar);
    drawArrow(ctx, x2, y2, -Math.PI / 2, ar);
  }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const tw = ctx.measureText(label).width + 8;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
  ctx.fillStyle = '#bbb';
  ctx.fillText(label, mx, my);
  ctx.restore();
}

// ── Green selection dims (D1–D5) — clickable label regions stored for editing ──
let elevGreenDimRegions = [];   // [{ dimKey, mx, my, w, h }] in draw space

// ── Orange wall-length dim — editable, with a lockable end ────────────────
let elevWallLock = 'start';       // 'start' (left end fixed) | 'end' (right end fixed)
let elevOrangeDimRegions = [];    // [{ kind, mx, my, w, h }] in draw space

function drawOrangeWallDim(ctx, info) {
  const { ox, oy, drawW, drawH, wallLenMm } = info;
  const y  = oy + drawH + 22;
  const ar = 5;
  ctx.save();
  ctx.strokeStyle = '#ff9500';
  ctx.lineWidth = 1.5;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.beginPath();
  ctx.moveTo(ox, y - 5);          ctx.lineTo(ox, y + 5);
  ctx.moveTo(ox + drawW, y - 5);  ctx.lineTo(ox + drawW, y + 5);
  ctx.moveTo(ox + ar, y);         ctx.lineTo(ox + drawW - ar, y);
  ctx.stroke();
  // Arrowheads
  ctx.fillStyle = '#ff9500';
  ctx.beginPath();
  ctx.moveTo(ox, y); ctx.lineTo(ox + ar, y + ar * 0.38); ctx.lineTo(ox + ar, y - ar * 0.38);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ox + drawW, y); ctx.lineTo(ox + drawW - ar, y + ar * 0.38); ctx.lineTo(ox + drawW - ar, y - ar * 0.38);
  ctx.closePath(); ctx.fill();
  // Label (click target → edit wall length)
  const label = Math.round(wallLenMm) + 'mm';
  const mx = ox + drawW / 2;
  const tw = ctx.measureText(label).width + 10;
  ctx.fillStyle = '#2a1c08';
  ctx.fillRect(mx - tw / 2, y - 8, tw, 16);
  ctx.strokeStyle = '#ff9500';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - tw / 2, y - 8, tw, 16);
  ctx.fillStyle = '#ff9500';
  ctx.fillText(label, mx, y);
  elevOrangeDimRegions.push({ kind: 'wall-len', mx, my: y, w: Math.max(tw, 40), h: 22 });
  // Lock icons — solid on the locked end, faded on the free end. Click to lock that side.
  const lockL = ox - 16, lockR = ox + drawW + 16;
  ctx.font = '12px Arial';
  ctx.globalAlpha = elevWallLock === 'start' ? 1 : 0.3;
  ctx.fillText('🔒', lockL, y);
  ctx.globalAlpha = elevWallLock === 'end' ? 1 : 0.3;
  ctx.fillText('🔒', lockR, y);
  ctx.globalAlpha = 1;
  ctx.restore();
  elevOrangeDimRegions.push({ kind: 'lock-start', mx: lockL, my: y, w: 28, h: 26 });
  elevOrangeDimRegions.push({ kind: 'lock-end',   mx: lockR, my: y, w: 28, h: 26 });
}

function drawGreenArrow(ctx, x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size,  size * 0.38);
  ctx.lineTo(size, -size * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGreenDim(ctx, x1, y1, x2, y2, label, vertical, dimKey) {
  ctx.save();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ar = 5;
  ctx.beginPath();
  if (!vertical) {
    ctx.moveTo(x1, y1 - 5); ctx.lineTo(x1, y1 + 5);
    ctx.moveTo(x2, y2 - 5); ctx.lineTo(x2, y2 + 5);
    if (x2 - x1 > ar * 2) { ctx.moveTo(x1 + ar, y1); ctx.lineTo(x2 - ar, y2); }
    ctx.stroke();
    if (x2 - x1 > ar * 2) {
      drawGreenArrow(ctx, x1, y1, 0,       ar);
      drawGreenArrow(ctx, x2, y2, Math.PI, ar);
    }
  } else {
    ctx.moveTo(x1 - 5, y1); ctx.lineTo(x1 + 5, y1);
    ctx.moveTo(x2 - 5, y2); ctx.lineTo(x2 + 5, y2);
    if (y2 - y1 > ar * 2) { ctx.moveTo(x1, y1 + ar); ctx.lineTo(x2, y2 - ar); }
    ctx.stroke();
    if (y2 - y1 > ar * 2) {
      drawGreenArrow(ctx, x1, y1,  Math.PI / 2, ar);
      drawGreenArrow(ctx, x2, y2, -Math.PI / 2, ar);
    }
  }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const tw = ctx.measureText(label).width + 10;
  ctx.fillStyle = '#0c2418';
  ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - tw / 2, my - 8, tw, 16);
  ctx.fillStyle = '#00ff88';
  ctx.fillText(label, mx, my);
  ctx.restore();
  // Clickable hit region around the label (Step 6 uses this)
  elevGreenDimRegions.push({ dimKey, mx, my, w: Math.max(tw, 40), h: 22 });
}

function drawRuler(ctx, info, direction) {
  const { ox, oy, drawW, drawH, scale, wallLenMm, wallHMm } = info;
  const total  = direction === 'horizontal' ? wallLenMm : wallHMm;
  const stepMm = rulerStepMm(total, scale);
  ctx.save();
  ctx.font = '9px Arial';
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1;
  for (let v = 0; v <= total + 0.5; v += stepMm) {
      const isMajor = (Math.round(v / stepMm) % 2 === 0);
      const tickLen = isMajor ? 10 : 5;
      if (direction === 'horizontal') {
        const px = ox + v * scale;
        ctx.beginPath(); ctx.moveTo(px, oy + drawH); ctx.lineTo(px, oy + drawH + tickLen); ctx.stroke();
        if (isMajor) {
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          const lbl = v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'm' : v + 'mm';
          ctx.fillText(lbl, px, oy + drawH + 13);
        }
      } else {
        const py = oy + drawH - v * scale;
        ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox - tickLen, py); ctx.stroke();
        if (isMajor) {
          ctx.fillStyle = '#555';
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          const lbl = v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'm' : v + 'mm';
          ctx.fillText(lbl, ox - 13, py);
        }
      }
    }
    ctx.restore();
  }
  
  function drawElevation() {
    if (!elevWall) return;
    const info = getElevDrawInfo();
    if (!info) return;
    const { W, H, ox, oy, drawW, drawH, scale, wallLenMm, wallHMm } = info;
  
    elevCtx.clearRect(0, 0, W, H);
    elevCtx.fillStyle = '#161616';
    elevCtx.fillRect(0, 0, W, H);
    // Apply zoom + pan transform for all drawing (inverse-transform in hit tests)
    elevCtx.save();
    elevCtx.setTransform(elevZoom, 0, 0, elevZoom, elevPanX, elevPanY);

    elevCtx.save();
    elevCtx.strokeStyle = '#252525';
    elevCtx.lineWidth = 1;
    for (let x = 0; x <= wallLenMm; x += 500) {
      const px = ox + x * scale;
      elevCtx.beginPath(); elevCtx.moveTo(px, oy); elevCtx.lineTo(px, oy + drawH); elevCtx.stroke();
    }
    for (let y = 0; y <= wallHMm; y += 500) {
      const py = oy + drawH - y * scale;
      elevCtx.beginPath(); elevCtx.moveTo(ox, py); elevCtx.lineTo(ox + drawW, py); elevCtx.stroke();
    }
    elevCtx.restore();
  
    elevCtx.fillStyle = '#3a3530';
    elevCtx.fillRect(ox, oy, drawW, drawH);
  
    const hatchH = Math.max(14, Math.min(28, drawH * 0.07));
    elevCtx.save();
    elevCtx.fillStyle = '#222018';
    elevCtx.fillRect(ox, oy + drawH, drawW, hatchH);
    elevCtx.strokeStyle = '#38342e';
    elevCtx.lineWidth = 1;
    for (let hx = ox - hatchH; hx < ox + drawW + hatchH; hx += 10) {
      elevCtx.beginPath();
      elevCtx.moveTo(hx,          oy + drawH);
      elevCtx.lineTo(hx + hatchH, oy + drawH + hatchH);
      elevCtx.stroke();
    }
    elevCtx.restore();
  
    elevCtx.save();
    elevCtx.setLineDash([6, 4]);
    elevCtx.strokeStyle = '#555';
    elevCtx.lineWidth = 1;
    elevCtx.beginPath();
    elevCtx.moveTo(ox, oy); elevCtx.lineTo(ox + drawW, oy);
    elevCtx.stroke();
    elevCtx.restore();
  
    elevCtx.strokeStyle = '#ff9500';
    elevCtx.lineWidth = 2;
    elevCtx.strokeRect(ox, oy, drawW, drawH);
  
    drawRuler(elevCtx, info, 'horizontal');
    drawRuler(elevCtx, info, 'vertical');
  
    elevCtx.save();
    elevCtx.font = '10px Arial';
    elevCtx.fillStyle = '#444';
    elevCtx.textAlign = 'center';
    elevCtx.fillText('CEILING  ' + wallHMm + 'mm', ox + drawW / 2, oy - 10);
    elevCtx.fillStyle = '#3a3a3a';
    elevCtx.textAlign = 'left';
    elevCtx.fillText('FL', ox + 3, oy + drawH - 3);
    elevCtx.textAlign = 'right';
    elevCtx.fillText('FL', ox + drawW - 3, oy + drawH - 3);
    elevCtx.restore();
  
    elevOpenings.forEach(op => {
      const rx = ox + op.distFromLeft * scale;
      const rw = op.width  * scale;
      const rh = op.height * scale;
      const ry = oy + drawH - op.floorDist * scale - rh;
      const isSel  = elevSelectedKind === 'opening' && elevSelectedItem === op;
      const isHov  = elevHoveredOp   === op;
      const isDrag = elevDragOp      === op;
  
      elevCtx.clearRect(rx, ry, rw, rh);
  
      elevCtx.fillStyle = op.type === 'door'
        ? 'rgba(90,50,15,0.75)'
        : 'rgba(80,150,195,0.45)';
      elevCtx.fillRect(rx, ry, rw, rh);
  
      if (op.type === 'window') {
        elevCtx.save();
        elevCtx.strokeStyle = 'rgba(160,215,245,0.45)';
        elevCtx.lineWidth = 1;
        elevCtx.beginPath();
        elevCtx.moveTo(rx + rw / 2, ry); elevCtx.lineTo(rx + rw / 2, ry + rh);
        elevCtx.moveTo(rx, ry + rh / 2); elevCtx.lineTo(rx + rw, ry + rh / 2);
        elevCtx.stroke();
        elevCtx.restore();
      } else {
        elevCtx.save();
        elevCtx.setLineDash([3, 3]);
        elevCtx.strokeStyle = 'rgba(190,120,60,0.4)';
        elevCtx.lineWidth = 1;
        elevCtx.beginPath();
        elevCtx.arc(rx, ry + rh, rw, -Math.PI / 2, 0);
        elevCtx.stroke();
        elevCtx.setLineDash([]);
        elevCtx.strokeStyle = 'rgba(190,120,60,0.55)';
        elevCtx.beginPath();
        elevCtx.moveTo(rx + rw * 0.09, ry);
        elevCtx.lineTo(rx + rw * 0.09, ry + rh);
        elevCtx.stroke();
        elevCtx.restore();
      }
  
      elevCtx.strokeStyle = (isSel || isDrag) ? '#ffdd00'
        : isHov ? '#ffffff'
        : op.type === 'door' ? '#c07030' : '#55aadd';
      elevCtx.lineWidth = (isSel || isDrag) ? 2.5 : isHov ? 2 : 1.5;
      elevCtx.strokeRect(rx, ry, rw, rh);
  
      if (rw > 46 && rh > 18) {
        elevCtx.save();
        elevCtx.font = 'bold 9px Arial';
        elevCtx.textAlign = 'center';
        elevCtx.textBaseline = 'middle';
        elevCtx.fillStyle = op.type === 'door' ? 'rgba(255,195,130,0.9)' : 'rgba(170,225,255,0.9)';
        elevCtx.fillText(
          (op.type === 'door' ? 'DOOR' : 'WIN') + '  ' + Math.round(op.width) + '×' + Math.round(op.height),
          rx + rw / 2, ry + rh / 2
        );
        elevCtx.restore();
      }

      // ── Selection highlight / dim overlay ──
      if (elevSelectedItem) {
        if (isSel) {
          elevCtx.fillStyle = 'rgba(0,255,136,0.35)';
          elevCtx.fillRect(rx, ry, rw, rh);
          elevCtx.strokeStyle = '#00ff88';
          elevCtx.lineWidth = 3;
          elevCtx.strokeRect(rx, ry, rw, rh);
        } else {
          elevCtx.fillStyle = 'rgba(0,0,0,0.25)';
          elevCtx.fillRect(rx, ry, rw, rh);
        }
      }
  
      // Selected item's grey dims are replaced by the 7 green dims — skip to avoid overlap
      if (!isSel) {
        drawDimLine(elevCtx, rx, ry - 22, rx + rw, ry - 22, Math.round(op.width) + 'mm', false);
        const heightDimX = (op.distFromLeft + op.width < wallLenMm - 100)
          ? rx + rw + 18 : rx - 18;
        drawDimLine(elevCtx, heightDimX, ry, heightDimX, ry + rh, Math.round(op.height) + 'mm', true);
        if (op.distFromLeft > 80) {
          drawDimLine(elevCtx, ox, oy + drawH + 44, rx, oy + drawH + 44, Math.round(op.distFromLeft) + 'mm', false);
        }
        if (op.floorDist > 50) {
          const fdX = (op.distFromLeft + op.width < wallLenMm - 100) ? rx + rw + 34 : rx - 34;
          drawDimLine(elevCtx, fdX, oy + drawH, fdX, ry + rh, Math.round(op.floorDist) + 'mm', true);
        }
      }
    });
  
    // ── Cabinet render loop ──────────────────────────────────────────────────
    elevCabinets.forEach(cab => {
      const rx = ox + cab.distFromLeft * scale;
      const rw = cab.width  * scale;
      const rh = cab.height * scale;
      const ry = oy + drawH - cab.floorDist * scale - rh;
      const isCabSel = elevSelectedKind === 'cabinet' && elevSelectedItem === cab;

      const isCabHov = elevHoveredCab === cab;
      elevCtx.fillStyle = isCabHov ? 'rgba(110,135,215,0.75)' : 'rgba(85,102,170,0.55)';
      elevCtx.fillRect(rx, ry, rw, rh);

      // Cabinet cross-hatch lines
      elevCtx.save();
      elevCtx.strokeStyle = 'rgba(120,140,210,0.35)';
      elevCtx.lineWidth = 1;
      elevCtx.beginPath();
      elevCtx.moveTo(rx, ry); elevCtx.lineTo(rx + rw, ry + rh);
      elevCtx.moveTo(rx + rw, ry); elevCtx.lineTo(rx, ry + rh);
      elevCtx.stroke();
      elevCtx.restore();

      elevCtx.strokeStyle = isCabHov ? '#ffffff' : '#7799cc';
      elevCtx.lineWidth   = isCabHov ? 2.5 : 1.5;
      elevCtx.strokeRect(rx, ry, rw, rh);

      if (rw > 40 && rh > 16) {
        elevCtx.save();
        elevCtx.font = 'bold 9px Arial';
        elevCtx.textAlign = 'center';
        elevCtx.textBaseline = 'middle';
        elevCtx.fillStyle = 'rgba(180,200,255,0.9)';
        const label = rw > 90
          ? cab.productName + '  ' + Math.round(cab.width) + '×' + Math.round(cab.height)
          : Math.round(cab.width) + '×' + Math.round(cab.height);
        elevCtx.fillText(label, rx + rw / 2, ry + rh / 2);
        elevCtx.restore();
      }

      // ── Selection highlight / dim overlay ──
      if (elevSelectedItem) {
        if (isCabSel) {
          elevCtx.fillStyle = 'rgba(0,255,136,0.35)';
          elevCtx.fillRect(rx, ry, rw, rh);
          elevCtx.strokeStyle = '#00ff88';
          elevCtx.lineWidth = 3;
          elevCtx.strokeRect(rx, ry, rw, rh);
        } else {
          elevCtx.fillStyle = 'rgba(0,0,0,0.25)';
          elevCtx.fillRect(rx, ry, rw, rh);
        }
      }

      if (!isCabSel) {
        drawDimLine(elevCtx, rx, ry - 22, rx + rw, ry - 22, Math.round(cab.width) + 'mm', false);
        const cabHDimX = (cab.distFromLeft + cab.width < wallLenMm - 100)
          ? rx + rw + 18 : rx - 18;
        drawDimLine(elevCtx, cabHDimX, ry, cabHDimX, ry + rh, Math.round(cab.height) + 'mm', true);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    elevOrangeDimRegions = [];
    drawOrangeWallDim(elevCtx, info);
    drawDimLine(elevCtx, ox - 46, oy, ox - 46, oy + drawH, Math.round(wallHMm) + 'mm', true);

    // ── 7 green dimension lines for the current selection (D1–D7) ────────────
    // Laid out as two dimension chains so labels never stack:
    //   horizontal row below the wall:  D1 | D6 (width) | D2
    //   vertical chain on the free side: D5 | D7 (height) | D4, with D3 (floor→top)
    //   on its own line further out.
    elevGreenDimRegions = [];
    if (elevSelectedItem) {
      const it = elevSelectedItem;
      const rx = ox + it.distFromLeft * scale;
      const rw = it.width  * scale;
      const rh = it.height * scale;
      const ry = oy + drawH - it.floorDist * scale - rh;
      const onRight = it.distFromLeft + it.width < wallLenMm - 100;

      const d1 = it.distFromLeft;                                // left wall → item
      const d2 = wallLenMm - (it.distFromLeft + it.width);       // item → right wall
      const d3 = it.floorDist + it.height;                       // floor → item top
      const d4 = wallHMm - (it.floorDist + it.height);           // item top → ceiling
      const d5 = it.floorDist;                                   // floor → item bottom

      // Horizontal chain — below the wall total and the grey item-dist labels
      const gy = oy + drawH + 64;
      drawGreenDim(elevCtx, ox, gy, rx, gy, Math.round(d1) + 'mm', false, 'D1');
      drawGreenDim(elevCtx, rx, gy, rx + rw, gy, Math.round(it.width) + 'mm', false, 'D6');
      drawGreenDim(elevCtx, rx + rw, gy, ox + drawW, gy, Math.round(d2) + 'mm', false, 'D2');

      // Vertical chain on the free side: floor→bottom, height, top→ceiling
      const vx  = onRight ? rx + rw + 34 : rx - 34;
      drawGreenDim(elevCtx, vx, ry + rh, vx, oy + drawH, Math.round(d5) + 'mm', true, 'D5');
      drawGreenDim(elevCtx, vx, ry, vx, ry + rh, Math.round(it.height) + 'mm', true, 'D7');
      drawGreenDim(elevCtx, vx, oy, vx, ry, Math.round(d4) + 'mm', true, 'D4');

      // D3 (floor → item top) spans D5+D7, so it gets its own line further out
      const vx2 = onRight ? rx + rw + 64 : rx - 64;
      drawGreenDim(elevCtx, vx2, ry, vx2, oy + drawH, Math.round(d3) + 'mm', true, 'D3');
    }
    // ─────────────────────────────────────────────────────────────────────────

    elevCtx.restore();   // close outer zoom/pan save
    elevCanvas._drawInfo = info;
    // Update zoom-reset button visibility
    const _zb = document.getElementById('elev-zoom-reset');
    if (_zb) {
      const zoomed = elevZoom !== 1 || elevPanX !== 0 || elevPanY !== 0;
      _zb.style.display = zoomed ? '' : 'none';
      _zb.textContent   = elevZoom.toFixed(1) + '×';
    }
  }
  
  function resizeElevCanvas() {
    const rect = elevCanvas.getBoundingClientRect();
    elevCanvas.width  = Math.floor(rect.width)  || elevationPanel.offsetWidth;
    elevCanvas.height = Math.floor(rect.height) || 400;
  }
  
  function openWallElevation(wallObj) {
    elevWall        = wallObj;
    elevOpenings    = wallObj.openings ? [...wallObj.openings] : [];
    selectedOpening = null;
    elevSelectedKind = null;
    elevSelectedItem = null;
    elevDragOp      = null;
    elevHoveredOp   = null;
    elevHoveredCab  = null;

    // ── Collect cabinets near this wall ──────────────────────────────────────
    const wDx = wallObj.end.x - wallObj.start.x;
    const wDz = wallObj.end.z - wallObj.start.z;
    const wallLen = Math.sqrt(wDx * wDx + wDz * wDz); // metres
    const ux = wDx / wallLen, uz = wDz / wallLen;      // unit along-wall (XZ)
    const px = -uz, pz = ux;                           // unit perp (XZ)

    // Room-interior side of this wall: sign of the room centroid's perpendicular
    // offset. Shared walls show only cabinets on THIS room's side — a cabinet
    // snapped to the far face (adjacent room) is excluded.
    let cenX = 0, cenZ = 0;
    walls.forEach(w => { cenX += (w.start.x + w.end.x) / 2; cenZ += (w.start.z + w.end.z) / 2; });
    cenX /= walls.length; cenZ /= walls.length;
    const interiorSide = Math.sign((cenX - wallObj.start.x) * px + (cenZ - wallObj.start.z) * pz);

    elevCabinets = [];
    placedItems.forEach(mesh => {
      if (!mesh.userData.product) return;
      if (mesh.userData.type === 'door' || mesh.userData.type === 'window') return;
      const product = mesh.userData.product;
      const relX = mesh.position.x - wallObj.start.x;
      const relZ = mesh.position.z - wallObj.start.z;
      const along      = relX * ux + relZ * uz;       // metres along wall (centre of cabinet)
      const perpSigned = relX * px + relZ * pz;       // signed metres from wall centreline
      const perp       = Math.abs(perpSigned);
      // Cabinets snap their back face to the wall face, so the centre sits
      // ~(wallThickness/2 + depth/2) off the centreline. Measure the gap between
      // the cabinet back face and the wall face instead of raw centreline distance.
      const halfDepth = mm(product.depth) / 2;
      const halfWall  = mm(settings.wallThickness) / 2;
      const faceGap   = perp - halfDepth - halfWall; // ~0 when snapped, negative when buried
      // Side filter: keep cabinets on the interior side. Centre buried inside the
      // wall body counts as ours; single isolated walls (no room) keep both sides.
      const sideOk = interiorSide === 0
        || Math.sign(perpSigned) === interiorSide
        || perp <= halfWall;
      if (sideOk && faceGap < mm(100) && faceGap > -mm(product.depth) && along >= 0 && along <= wallLen) {
        const widthMm  = product.width;   // mm
        const heightMm = product.height;  // mm
        elevCabinets.push({
          mesh,
          productName:  product.name,
          width:        widthMm,
          height:       heightMm,
          distFromLeft: (along - mm(widthMm) / 2) * 1000, // mm, left edge
          floorDist:    (mesh.position.y - mm(heightMm) / 2) * 1000, // mm, bottom edge
          kind:         'cabinet',
        });
      }
    });
    // ─────────────────────────────────────────────────────────────────────────
  
    const wallIdx = walls.indexOf(wallObj) + 1;
    document.getElementById('elev-wall-label').textContent = 'Wall ' + wallIdx;
    document.getElementById('elev-wall-info').textContent  =
      Math.round(wallObj.start.distanceTo(wallObj.end) * 1000) + 'mm wide  ×  ' + settings.ceilingHeight + 'mm high';
    document.getElementById('elev-opening-editor').style.display = 'none';
    document.getElementById('pricing-panel').classList.add('elevation-open');
  
    elevationPanel.style.display = 'flex';
    requestAnimationFrame(() => { resizeElevCanvas(); drawElevation(); });
  }
  
  function closeWallElevation() {
    document.getElementById('pricing-panel').classList.remove('elevation-open');
    elevationPanel.style.display = 'none';
    elevWall = null; selectedOpening = null; elevDragOp = null; elevHoveredOp = null;
    elevHoveredCab = null;
    elevSelectedKind = null; elevSelectedItem = null;
    if (typeof removeGreenDimInput === 'function') removeGreenDimInput();
    elevCabinets = [];
    elevZoom = 1; elevPanX = 0; elevPanY = 0;
    _elevPinchActive = false; _elevPinchJustEnded = false;
  }
  
  elevCanvas.addEventListener('mousemove', (e) => {
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    // Inverse-transform from element space → draw space (accounts for zoom/pan)
    const cx = (e.clientX - rect.left - elevPanX) / elevZoom;
    const cy = (e.clientY - rect.top  - elevPanY) / elevZoom;
    const { ox, scale, wallLenMm } = info;
  
    if (elevDragOp) {
      const rawMm   = (cx - ox) / scale - elevDragOffsetMm;
      const clamped = Math.max(0, Math.min(wallLenMm - elevDragOp.width, Math.round(rawMm / 50) * 50));
      elevDragOp.distFromLeft = clamped;
      syncElevEditorFields(elevDragOp);
      drawElevation();
      return;
    }
    // Cabinets first (front-most), then openings — mirrors click priority
    const cabHit = cabinetHitTest(cx, cy, info);
    const opHit  = cabHit ? null : openingHitTest(cx, cy, info);
    if (opHit !== elevHoveredOp || cabHit !== elevHoveredCab) {
      elevHoveredOp  = opHit;
      elevHoveredCab = cabHit;
      elevCanvas.style.cursor = opHit ? 'grab' : (cabHit ? 'pointer' : 'default');
      drawElevation();
    }
  });
  
  elevCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - elevPanX) / elevZoom;
    const cy = (e.clientY - rect.top  - elevPanY) / elevZoom;
    const { ox, scale } = info;
  
    const hit = openingHitTest(cx, cy, info);
    if (hit) {
      elevDragOp       = hit;
      elevDragOffsetMm = (cx - ox) / scale - hit.distFromLeft;
      elevCanvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  
  elevCanvas.addEventListener('mouseup', () => {
    if (elevDragOp) {
      syncOpeningsTo3D(elevWall);
      elevDragOp = null;
      elevCanvas.style.cursor = elevHoveredOp ? 'grab' : 'default';
      drawElevation();
    }
  });
  
  elevCanvas.addEventListener('click', (e) => {
    if (elevDragOp || _elevPinchJustEnded) return;
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - elevPanX) / elevZoom;
    const cy = (e.clientY - rect.top  - elevPanY) / elevZoom;
    // Orange wall dim: lock toggles + click-to-edit wall length
    for (const r of elevOrangeDimRegions) {
      if (Math.abs(cx - r.mx) <= r.w / 2 && Math.abs(cy - r.my) <= r.h / 2) {
        if (r.kind === 'lock-start')      { elevWallLock = 'start'; drawElevation(); }
        else if (r.kind === 'lock-end')   { elevWallLock = 'end';   drawElevation(); }
        else                              { openWallLenInput(r); }
        return;
      }
    }
    // Green dim labels take priority — click one to edit it in place
    if (elevSelectedItem) {
      for (const r of elevGreenDimRegions) {
        // Cabinet size comes from the product — D6/D7 are display-only
        if (elevSelectedKind === 'cabinet' && (r.dimKey === 'D6' || r.dimKey === 'D7')) continue;
        if (Math.abs(cx - r.mx) <= r.w / 2 && Math.abs(cy - r.my) <= r.h / 2) {
          openGreenDimInput(r);
          return;
        }
      }
    }
    // Hit-test cabinets first (front-most), then openings
    const cabHit = cabinetHitTest(cx, cy, info);
    const opHit  = cabHit ? null : openingHitTest(cx, cy, info);
    if (cabHit)      selectElevItem('cabinet', cabHit);
    else if (opHit)  selectElevItem('opening', opHit);
    else             clearElevSelection();
    drawElevation();
  });
  
  // ✅ FIX: Touch support — single-finger drag + two-finger pinch-to-zoom
  elevCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Cancel ongoing drag then start pinch
      elevDragOp = null;
      elevCanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      _elevPinchActive = true;
      const t0 = e.touches[0], t1 = e.touches[1];
      _elevPinchDist0 = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
      _elevPinchZoom0  = elevZoom;
      _elevPinchPanX0  = elevPanX; _elevPinchPanY0 = elevPanY;
      _elevPinchCx0    = (t0.clientX + t1.clientX) / 2;
      _elevPinchCy0    = (t0.clientY + t1.clientY) / 2;
    } else if (e.touches.length === 1 && !_elevPinchActive) {
      const t = e.touches[0];
      elevCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0, bubbles: true }));
    }
  }, { passive: false });

  elevCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (_elevPinchActive && e.touches.length >= 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
      const newZoom = Math.max(0.4, Math.min(6, _elevPinchZoom0 * (dist / _elevPinchDist0)));
      const rect = elevCanvas.getBoundingClientRect();
      // Initial pinch anchor in canvas space
      const anchorCx0 = _elevPinchCx0 - rect.left;
      const anchorCy0 = _elevPinchCy0 - rect.top;
      // The draw-space point that was under the initial pinch centre
      const drawAx = (anchorCx0 - _elevPinchPanX0) / _elevPinchZoom0;
      const drawAy = (anchorCy0 - _elevPinchPanY0) / _elevPinchZoom0;
      // Current midpoint in canvas space — moving fingers pans while zooming
      const currMidX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const currMidY = (t0.clientY + t1.clientY) / 2 - rect.top;
      elevZoom = newZoom;
      elevPanX = currMidX - drawAx * newZoom;
      elevPanY = currMidY - drawAy * newZoom;
      drawElevation();
      return;
    }
    if (!_elevPinchActive && e.touches.length === 1) {
      const t = e.touches[0];
      elevCanvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
    }
  }, { passive: false });

  elevCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (_elevPinchActive) {
      if (e.touches.length < 2) {
        _elevPinchActive    = false;
        _elevPinchJustEnded = true;
        setTimeout(() => { _elevPinchJustEnded = false; }, 350);
      }
      return;   // suppress synthetic click/mouseup after a pinch gesture
    }
    elevCanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      elevCanvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
    }
  }, { passive: false });
  
  function syncElevEditorFields(item) {
    document.getElementById('elev-width').value      = Math.round(item.width);
    document.getElementById('elev-height').value     = Math.round(item.height);
    document.getElementById('elev-dist').value       = Math.round(item.distFromLeft);
    document.getElementById('elev-floor-dist').value = Math.round(item.floorDist);
  }
  
  function showElevOpeningEditor(op) {
    document.getElementById('elev-editor-title').textContent = op.type === 'door' ? 'Edit Door' : 'Edit Window';
    syncElevEditorFields(op);
    document.getElementById('elev-opening-editor').style.display = 'block';
  }

  // ── Unified selection: openings AND cabinets share the 4-field grid editor ──
  function setElevDimInputsDisabled(disabled) {
    ['elev-width', 'elev-height'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = disabled;
      el.style.opacity     = disabled ? '0.4' : '';
      el.style.cursor      = disabled ? 'not-allowed' : '';
      el.style.background  = disabled ? '#2a2a2a' : '';
    });
  }

  function selectElevItem(kind, item) {
    elevSelectedKind = kind;
    elevSelectedItem = item;
    selectedOpening  = kind === 'opening' ? item : null;
    const title = kind === 'cabinet'
      ? (item.productName || 'Cabinet')
      : (item.type === 'door' ? 'Edit Door' : 'Edit Window');
    document.getElementById('elev-editor-title').textContent = title;
    syncElevEditorFields(item);
    setElevDimInputsDisabled(kind === 'cabinet');   // width/height read-only for cabinets
    document.getElementById('elev-opening-editor').style.display = 'block';
    // Editor visibility changes the canvas flex height — resync bitmap size or
    // click coordinates drift vertically (labels become unclickable).
    requestAnimationFrame(() => { resizeElevCanvas(); drawElevation(); });
  }

  function clearElevSelection() {
    elevSelectedKind = null;
    elevSelectedItem = null;
    selectedOpening  = null;
    setElevDimInputsDisabled(false);
    document.getElementById('elev-opening-editor').style.display = 'none';
    requestAnimationFrame(() => { resizeElevCanvas(); drawElevation(); });
  }

  // ── Click-to-edit green dims (D1–D5) ──────────────────────────────────────
  let _greenDimInput = null;

  function removeGreenDimInput() {
    if (_greenDimInput) { _greenDimInput.remove(); _greenDimInput = null; }
  }

  function greenDimValue(dimKey) {
    const it = elevSelectedItem;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    const wallHMm   = settings.ceilingHeight;
    switch (dimKey) {
      case 'D1': return it.distFromLeft;
      case 'D2': return wallLenMm - (it.distFromLeft + it.width);
      case 'D3': return it.floorDist + it.height;
      case 'D4': return wallHMm - (it.floorDist + it.height);
      case 'D5': return it.floorDist;
      case 'D6': return it.width;
      case 'D7': return it.height;
    }
  }

  // ── Cabinet write-back: elevation record → 3D mesh position (+ undo) ──────
  function writeCabinetTo3D(cab) {
    if (!elevWall || !cab.mesh) return;
    const wDx = elevWall.end.x - elevWall.start.x;
    const wDz = elevWall.end.z - elevWall.start.z;
    const len = Math.sqrt(wDx * wDx + wDz * wDz);
    if (len < 1e-6) return;
    const ux = wDx / len, uz = wDz / len;   // unit along-wall (XZ)
    const px = -uz, pz = ux;                 // unit perp (XZ)
    const mesh = cab.mesh;
    // Preserve the cabinet's existing perpendicular offset from the wall face
    const relX = mesh.position.x - elevWall.start.x;
    const relZ = mesh.position.z - elevWall.start.z;
    const perpSigned = relX * px + relZ * pz;

    const from  = mesh.position.clone();
    const along = mm(cab.distFromLeft + cab.width / 2);   // centre of cabinet
    mesh.position.x = elevWall.start.x + ux * along + px * perpSigned;
    mesh.position.z = elevWall.start.z + uz * along + pz * perpSigned;
    mesh.position.y = mm(cab.floorDist) + mm(cab.height) / 2;

    if (from.distanceTo(mesh.position) > 0.001) {
      pushHistory({ type: 'move-item', data: { mesh, from, to: mesh.position.clone() } });
    }
  }

  // Writes the edited dim back to distFromLeft/floorDist (clamped to the wall).
  // Returns true if the typed value had to be clamped.
  function applyGreenDimEdit(dimKey, typed) {
    const it = elevSelectedItem;
    if (!it || !elevWall || isNaN(typed)) return false;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    const wallHMm   = settings.ceilingHeight;
    let target, clamped;
    if (dimKey === 'D1' || dimKey === 'D2') {
      target  = dimKey === 'D1' ? typed : wallLenMm - it.width - typed;
      clamped = Math.max(0, Math.min(wallLenMm - it.width, target));
      it.distFromLeft = clamped;
    } else if (dimKey === 'D6') {           // width — openings only, left edge anchored
      target  = typed;
      clamped = Math.max(100, Math.min(wallLenMm - it.distFromLeft, target));
      it.width = clamped;
    } else if (dimKey === 'D7') {           // height — openings only, bottom edge anchored
      target  = typed;
      clamped = Math.max(100, Math.min(wallHMm - it.floorDist, target));
      it.height = clamped;
    } else {
      if (dimKey === 'D3')      target = typed - it.height;
      else if (dimKey === 'D4') target = wallHMm - typed - it.height;
      else                      target = typed;          // D5
      clamped = Math.max(0, Math.min(wallHMm - it.height, target));
      it.floorDist = clamped;
    }
    syncElevEditorFields(it);
    if (elevSelectedKind === 'opening') {
      syncOpeningsTo3D(elevWall);
    } else if (elevSelectedKind === 'cabinet') {
      writeCabinetTo3D(it);   // moves the 3D mesh + pushes move-item history
    }
    return clamped !== target;
  }

  function openGreenDimInput(region) {
    removeGreenDimInput();
    const rect = elevCanvas.getBoundingClientRect();
    // draw space → viewport coords
    const sx = rect.left + region.mx * elevZoom + elevPanX;
    const sy = rect.top  + region.my * elevZoom + elevPanY;

    const input = document.createElement('input');
    input.type  = 'number';
    input.value = Math.round(greenDimValue(region.dimKey));
    input.style.cssText = [
      'position:fixed', 'z-index:1500',
      'left:' + Math.round(sx - 38) + 'px',
      'top:'  + Math.round(sy - 14) + 'px',
      'width:76px', 'height:28px',
      'background:#fff', 'color:#111',
      'border:2px solid #00ff88', 'border-radius:4px',
      'font:bold 14px Arial', 'text-align:center',
      'transition:background 0.15s,border-color 0.15s'
    ].join(';');
    document.body.appendChild(input);
    _greenDimInput = input;
    input.focus();
    input.select();

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const typed = parseFloat(input.value);
      if (isNaN(typed)) { removeGreenDimInput(); drawElevation(); return; }
      const wasClamped = applyGreenDimEdit(region.dimKey, typed);
      if (wasClamped) {
        // Flash red 300ms, then clean up and redraw.
        // Remove only THIS input — a new one may have opened during the flash.
        input.style.background  = '#ffd5d5';
        input.style.borderColor = '#ff3333';
        setTimeout(() => {
          input.remove();
          if (_greenDimInput === input) _greenDimInput = null;
          drawElevation();
        }, 300);
      } else {
        removeGreenDimInput();
        drawElevation();
      }
    };
    const cancel = () => {
      if (done) return;
      done = true;
      removeGreenDimInput();
      drawElevation();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();                 // don't trigger planner shortcuts / Escape-close
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);   // click-elsewhere commits
  }

  // ── Orange wall-length edit — resizes the real wall via resizeLockedWall ──
  function openWallLenInput(region) {
    removeGreenDimInput();
    const rect = elevCanvas.getBoundingClientRect();
    const sx = rect.left + region.mx * elevZoom + elevPanX;
    const sy = rect.top  + region.my * elevZoom + elevPanY;

    const input = document.createElement('input');
    input.type  = 'number';
    input.value = Math.round(elevWall.start.distanceTo(elevWall.end) * 1000);
    input.style.cssText = [
      'position:fixed', 'z-index:1500',
      'left:' + Math.round(sx - 38) + 'px',
      'top:'  + Math.round(sy - 14) + 'px',
      'width:76px', 'height:28px',
      'background:#fff', 'color:#111',
      'border:2px solid #ff9500', 'border-radius:4px',
      'font:bold 14px Arial', 'text-align:center',
      'transition:background 0.15s,border-color 0.15s'
    ].join(';');
    document.body.appendChild(input);
    _greenDimInput = input;          // shared slot — same lifecycle management
    input.focus();
    input.select();

    let done = false;
    const finish = () => {
      input.remove();
      if (_greenDimInput === input) _greenDimInput = null;
    };
    const commit = () => {
      if (done) return;
      done = true;
      const typed = parseFloat(input.value);
      if (isNaN(typed) || !elevWall) { finish(); drawElevation(); return; }
      const clampedVal = Math.max(100, typed);
      const apply = () => {
        const keepLock = elevWallLock;
        // resizeLockedWall anchors the locked end; it rebuilds the wall + room loop
        const newWall = resizeLockedWall(elevWall, mm(clampedVal), elevWallLock);
        if (newWall) {
          openWallElevation(newWall);   // rebind elevation to the rebuilt wall
          elevWallLock = keepLock;
        } else {
          drawElevation();              // resize refused (e.g. adjacent wall < 50mm)
        }
      };
      if (clampedVal !== typed) {
        input.style.background  = '#ffd5d5';
        input.style.borderColor = '#ff3333';
        setTimeout(() => { finish(); apply(); }, 300);
      } else {
        finish();
        apply();
      }
    };
    const cancel = () => {
      if (done) return;
      done = true;
      finish();
      drawElevation();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  }
  
  document.getElementById('elev-apply').addEventListener('click', () => {
    if (elevSelectedKind !== 'opening' || !elevSelectedItem || !elevWall) return;
    const op = elevSelectedItem;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    op.width        = Math.max(100, parseFloat(document.getElementById('elev-width').value)      || 100);
    op.height       = Math.max(100, parseFloat(document.getElementById('elev-height').value)     || 100);
    op.distFromLeft = Math.max(0, Math.min(wallLenMm - op.width,
                                     parseFloat(document.getElementById('elev-dist').value) || 0));
    op.floorDist    = Math.max(0, parseFloat(document.getElementById('elev-floor-dist').value)   || 0);
    syncElevEditorFields(op);
    syncOpeningsTo3D(elevWall);
    drawElevation();
  });
  
  document.getElementById('elev-delete-opening').addEventListener('click', () => {
    if (elevSelectedKind !== 'opening' || !elevSelectedItem || !elevWall) return;
    elevOpenings      = elevOpenings.filter(o => o !== elevSelectedItem);
    elevWall.openings = elevOpenings;
    clearElevSelection();
    syncOpeningsTo3D(elevWall);
    drawElevation();
  });
  
  document.getElementById('elev-editor-cancel').addEventListener('click', () => {
    clearElevSelection();
    drawElevation();
  });
  
  document.getElementById('elev-center-opening').addEventListener('click', () => {
    if (elevSelectedKind !== 'opening' || !elevSelectedItem || !elevWall) return;
    const op = elevSelectedItem;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    op.distFromLeft = Math.round((wallLenMm - op.width) / 2 / 50) * 50;
    syncElevEditorFields(op);
    syncOpeningsTo3D(elevWall);
    drawElevation();
  });
  
  document.getElementById('elev-add-door').addEventListener('click', () => {
    if (!elevWall) return;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    const op = { type: 'door', width: 900, height: 2100, distFromLeft: 200, floorDist: 0 };
    op.distFromLeft = Math.min(op.distFromLeft, wallLenMm - op.width - 100);
    elevOpenings.push(op);
    elevWall.openings = elevOpenings;
    syncOpeningsTo3D(elevWall);
    selectElevItem('opening', op);
    drawElevation();
  });
  
  document.getElementById('elev-add-window').addEventListener('click', () => {
    if (!elevWall) return;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    const op = { type: 'window', width: 1200, height: 1200, distFromLeft: 200, floorDist: 900 };
    op.distFromLeft = Math.min(op.distFromLeft, wallLenMm - op.width - 100);
    elevOpenings.push(op);
    elevWall.openings = elevOpenings;
    syncOpeningsTo3D(elevWall);
    selectElevItem('opening', op);
    drawElevation();
  });
  
  document.getElementById('elev-close').addEventListener('click', closeWallElevation);
  
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elevationPanel.style.display === 'flex') closeWallElevation();
  });
  
  function syncOpeningsTo3D(wallObj) {
    placedItems = placedItems.filter(m => {
      if (m.userData.parentWall === wallObj) { scene.remove(m); return false; }
      return true;
    });
    const angle = wallObj.mesh.rotation.y;
    (wallObj.openings || []).forEach(op => {
      const iw = mm(op.width), ih = mm(op.height);
      const iy = SLAB_H + mm(op.floorDist) + ih / 2;
      const color = op.type === 'door' ? 0x8B4513 : 0x87CEEB;
      const t = mm(op.distFromLeft) + iw / 2;
      const dx = wallObj.end.x - wallObj.start.x, dz = wallObj.end.z - wallObj.start.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const nx = dx / len, nz = dz / len;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(iw, ih, mm(settings.wallThickness) + 0.05),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75 })
      );
      mesh.position.set(wallObj.start.x + nx * t, iy, wallObj.start.z + nz * t);
      mesh.rotation.y = angle;
      mesh.userData = { type: op.type, parentWall: wallObj };
      scene.add(mesh);
      placedItems.push(mesh);
    });
  }
  
  function addOpening(wallObj, type) {
    if (!wallObj.openings) wallObj.openings = [];
    const wallLenMm = wallObj.start.distanceTo(wallObj.end) * 1000;
    const op = type === 'door'
      ? { type: 'door',   distFromLeft: 200, floorDist: 0,   width: 900,  height: 2100 }
      : { type: 'window', distFromLeft: 200, floorDist: 900, width: 1200, height: 1200 };
    op.distFromLeft = Math.min(op.distFromLeft, wallLenMm - op.width - 100);
    wallObj.openings.push(op);
    syncOpeningsTo3D(wallObj);
  }
  
  function lockRoom() {
    if (walls.length < 3) return;
    roomCorners = [walls[0].start.clone()];
    walls.forEach(w => roomCorners.push(w.end.clone()));
    roomLocked = true;
    buildFloorMesh();
  }

// ── Auto floor ───────────────────────────────────────────────────────────────
// Traces the closed wall loop and builds a dark floor mesh at y ≈ 0.
// Uses wall centrelines directly — walls sit on top and hide any overlap.
function buildFloorMesh() {
  if (floorMesh) {
    scene.remove(floorMesh);
    if (floorMesh.geometry) floorMesh.geometry.dispose();
    if (floorMesh.material) floorMesh.material.dispose();
    floorMesh = null;
  }
  if (walls.length < 3) return;

  // Walk the wall graph to trace a closed polygon
  const poly = [];
  const startKey = cornerKey(walls[0].start);
  poly.push(walls[0].start.clone());
  let prevWall = walls[0];
  let curKey   = cornerKey(walls[0].end);
  for (let i = 0; i < walls.length; i++) {
    if (curKey === startKey) break;
    const next = walls.find(w => w !== prevWall &&
      (cornerKey(w.start) === curKey || cornerKey(w.end) === curKey));
    if (!next) return;                       // open chain — no floor
    const [cx, cz] = curKey.split(',').map(Number);
    poly.push(new THREE.Vector3(cx, 0, cz));
    curKey = cornerKey(next.start) === curKey ? cornerKey(next.end) : cornerKey(next.start);
    prevWall = next;
  }
  if (poly.length < 3) return;

  // Build a 300mm-thick slab using the wall centreline polygon.
  // ExtrudeGeometry depth goes in +Z; with rotation.x = Math.PI/2 that maps to -Y,
  // so we position the mesh at SLAB_H so the slab spans y=0 → y=SLAB_H.
  const shape = new THREE.Shape();
  shape.moveTo(poly[0].x, poly[0].z);
  for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i].x, poly[i].z);
  shape.closePath();

  floorMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: SLAB_H, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x3a3530, side: THREE.DoubleSide })
  );
  floorMesh.rotation.x = Math.PI / 2;
  floorMesh.position.y = SLAB_H;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
}
  
  // ── Parametric rescale ───────────────────────────────────────────────────
  // When one wall's length changes in a closed room, neighbouring walls
  // PERPENDICULAR to the shift translate whole (angles preserved); the first
  // wall PARALLEL to the shift absorbs it as a length change. Adjacency is
  // derived from shared corner positions (cornerKey), never from `walls`
  // array order — buildWall() appends, so array order is not loop order.

  // Remove the door/window meshes attached to a wall (they reference it via parentWall).
  function clearWallOpeningMeshes(w) {
    placedItems = placedItems.filter(m => {
      if (m.userData && m.userData.parentWall === w) { scene.remove(m); return false; }
      return true;
    });
  }

  function wallsAtCorner(key, except) {
    return walls.filter(w => w !== except &&
      (cornerKey(w.start) === key || cornerKey(w.end) === key));
  }

  // Walk the loop from the moving corner and plan which walls shift.
  // Returns [{ wall, ns, ne }] or null when the topology can't support it
  // (open chain, T-junction, or loop closes before any wall absorbs the delta).
  function planRoomRescale(wallObj, movingCorner, anchorCorner, delta) {
    const dHat = delta.clone().normalize();
    const anchorKey = cornerKey(anchorCorner);
    const changes = [];
    let prevWall = wallObj;
    let corner = movingCorner.clone();
    for (let i = 0; i < walls.length; i++) {
      const key = cornerKey(corner);
      if (key === anchorKey) return null;       // reached the anchor without absorbing
      const candidates = wallsAtCorner(key, prevWall);
      if (candidates.length !== 1) return null; // open chain or T-junction
      const w = candidates[0];
      const entryIsStart = cornerKey(w.start) === key;
      const far = entryIsStart ? w.end : w.start;
      const unit = new THREE.Vector3().subVectors(far, corner).normalize();
      if (Math.abs(unit.dot(dHat)) < 0.1) {
        // Perpendicular to the shift → translate the whole wall, keep walking.
        changes.push({ wall: w, ns: w.start.clone().add(delta), ne: w.end.clone().add(delta) });
        prevWall = w;
        corner = far.clone();
        continue;
      }
      // Parallel (or oblique — graceful degradation) → absorb as a length change.
      changes.push({
        wall: w,
        ns: entryIsStart ? w.start.clone().add(delta) : w.start.clone(),
        ne: entryIsStart ? w.end.clone()              : w.end.clone().add(delta),
      });
      return changes;
    }
    return null;
  }

  function resizeLockedWall(wallObj, newLengthM, anchorEnd = 'start') {
    if (!(newLengthM > 0)) return;
    const anchor = anchorEnd === 'end' ? wallObj.end.clone()   : wallObj.start.clone();
    const moving = anchorEnd === 'end' ? wallObj.start.clone() : wallObj.end.clone();
    const dir    = new THREE.Vector3().subVectors(moving, anchor).normalize();
    const newMov = anchor.clone().addScaledVector(dir, newLengthM);
    const delta  = new THREE.Vector3().subVectors(newMov, moving);
    if (delta.lengthSq() < 1e-10) return;

    // Keep original start/end roles so openings' distFromLeft stays meaningful.
    const selfNs = anchorEnd === 'end' ? newMov.clone() : wallObj.start.clone();
    const selfNe = anchorEnd === 'end' ? wallObj.end.clone() : newMov.clone();

    // Closed loop → plan the chain (detected geometrically — works even if the
    // roomLocked flag is stale); open chain / odd topology → resize this wall only.
    const plan = planRoomRescale(wallObj, moving, anchor, delta);
    const changes = [{ wall: wallObj, ns: selfNs, ne: selfNe }, ...(plan || [])];

    for (const c of changes) {
      if (c.ns.distanceTo(c.ne) < mm(50) + 1e-6) {
        alert('Cannot resize: an adjacent wall would become shorter than 50mm.');
        return;
      }
    }

    const removed = changes.map(c => c.wall);
    removed.forEach(w => {
      scene.remove(w.mesh);
      if (w.capMeshes) w.capMeshes.forEach(c => scene.remove(c));
      if (w.label2D)   wall2DLabelGroup.remove(w.label2D);
      clearWallOpeningMeshes(w);
    });
    walls = walls.filter(w => !removed.includes(w));

    const restored = [];
    changes.forEach(c => {
      const nw = buildWall(c.ns, c.ne, true);
      if (!nw) return;                          // guarded above; belt-and-braces
      carryWallStyle(c.wall, nw);
      if (c.wall.openings && c.wall.openings.length) {
        nw.openings = c.wall.openings.map(op => ({ ...op }));
        syncOpeningsTo3D(nw);
      }
      restored.push(nw);
    });
    pushHistory({ type: 'resize-wall', data: { removed, restored } });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
    updateRoomArea();
    return restored[0];   // the rebuilt wall for wallObj (elevation rebinds to it)
  }
  
// ── Drag state ──────────────────────────────────────────────────────────────
let dragOffset = new THREE.Vector3();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dragHit   = new THREE.Vector3();

function getFloorPosFromRay(e) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const ok = raycaster.ray.intersectPlane(_dragPlane, _dragHit);
  return ok ? _dragHit.clone() : null;
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || mode !== 'select') return;
    // Check for wall handle drag
    updateMouse(e);
    raycaster.setFromCamera(mouse, activeCamera);
    const handleHits = raycaster.intersectObjects(wallHandleGroup.children);
    if (handleHits.length > 0) {
      canvas._draggingHandle = handleHits[0].object;
      controls.enabled = false;
      return;
    }
  
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);

  const itemHits = raycaster.intersectObjects(placedItems, true);
  if (itemHits.length > 0) {
    let hit = itemHits[0].object;
    while (hit.parent && !placedItems.includes(hit)) hit = hit.parent;

    // Ctrl/Cmd: multi-select toggle is handled on click — don't start a drag.
    if (e.ctrlKey || e.metaKey) return;

    dragTarget   = hit;
    dragStartPos = dragTarget.position.clone();
    selectedItem = dragTarget;
    controls.enabled = false;
    selectCabinet(hit, false);          // show the cyan selection box immediately

    const floorHit = getFloorPosFromRay(e);
    if (floorHit) {
      dragOffset.set(
        dragTarget.position.x - floorHit.x,
        0,
        dragTarget.position.z - floorHit.z
      );
    } else {
      dragOffset.set(0, 0, 0);
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
lastMouseY = e.clientY;
  if (isPanning2D) return;

  if (mode === 'select' && !dragTarget) {
    updateMouse(e);
    raycaster.setFromCamera(mouse, activeCamera);
    const hits = raycaster.intersectObjects(walls.map(w => w.mesh))
      .filter(h => walls.includes(h.object.userData.wallObj));
    if (hits.length > 0) {
      const hit = hits[0].object.userData.wallObj;
      if (hoveredWall !== hit) {
        if (hoveredWall && hoveredWall !== selectedWall)
          hoveredWall.mesh.material.color.set(selectedWalls.includes(hoveredWall) ? WALL_MULTI_COLOR : wallBaseColor(hoveredWall));
        hoveredWall = hit;
        if (hoveredWall !== selectedWall && !selectedWalls.includes(hoveredWall))
          hoveredWall.mesh.material.color.set(0xf0e0c0);
      }
      canvas.style.cursor = 'pointer';
    } else {
      if (hoveredWall && hoveredWall !== selectedWall)
        hoveredWall.mesh.material.color.set(selectedWalls.includes(hoveredWall) ? WALL_MULTI_COLOR : wallBaseColor(hoveredWall));
      hoveredWall = null;
      canvas.style.cursor = 'default';
    }
  }

  dimLabel.style.left  = (e.clientX + 15) + 'px';
  dimLabel.style.top   = (e.clientY - 10) + 'px';
  closeHint.style.left = (e.clientX + 15) + 'px';
  closeHint.style.top  = (e.clientY + 10) + 'px';

  if (mode === 'draw-wall' && wallStart) {
    const pt = getFloorPos(e); if (!pt) return;
    let s = snapToCorner(snapToGrid(pt));
  
    // Quick Draw: follow cursor freely; snap to 90° axis when Shift is held
    // OR when within 5° of an axis. (parallel snap is wired in step 2)
    let _snapMode = 'free';   // 'free' | '90deg' | 'parallel'
    {
      const _rdx = s.x - wallStart.x;
      const _rdz = s.z - wallStart.z;
      const _len = Math.hypot(_rdx, _rdz);
      if (_len > 1e-4) {
        const _ang    = Math.atan2(Math.abs(_rdz), Math.abs(_rdx)) * 180 / Math.PI; // 0..90
        const _toAxis = Math.min(_ang, 90 - _ang);                                   // 0 = on-axis
        if (isShiftModifierActive() || _toAxis <= 5) {
          s = Math.abs(_rdx) >= Math.abs(_rdz)
            ? new THREE.Vector3(s.x, 0, wallStart.z)
            : new THREE.Vector3(wallStart.x, 0, s.z);
          _snapMode = '90deg';
        }
      }
    }
  
    // Apply locked length BEFORE preview
    if (wallDimLocked && wallDimLockedLen > 0) {
      const _ax = Math.abs(s.x - wallStart.x);
      const _az = Math.abs(s.z - wallStart.z);
      if (_ax >= _az) {
        s = new THREE.Vector3(
          wallStart.x + Math.sign(s.x - wallStart.x) * wallDimLockedLen,
          0,
          wallStart.z
        );
      } else {
        s = new THREE.Vector3(
          wallStart.x,
          0,
          wallStart.z + Math.sign(s.z - wallStart.z) * wallDimLockedLen
        );
      }
    }
  
    // Align to the chain's starting corner: snap to its X/Z axis + green guide
    s = snapToStartLine(s, firstPoint);
    showStartAxisGuides(firstPoint, s);

    // Close-room proximity check
    if (firstPoint && s.distanceTo(firstPoint) < 0.2) {
      s = firstPoint.clone();
      closeHint.style.display = 'block';
    } else {
      closeHint.style.display = 'none';
    }
  
    updatePreview(s);

    // Snap-mode colour feedback: green = 90°, blue = parallel, orange = free
    const _snapColor = _snapMode === '90deg'    ? 0x00ff88
                     : _snapMode === 'parallel' ? 0x4488ff
                     :                            0xff9500;
    if (previewLine) previewLine.material.color.setHex(_snapColor);
    const _snapCss = _snapMode === '90deg'    ? '#00ff88'
                   : _snapMode === 'parallel' ? '#4488ff'
                   :                            '#ff9500';
    wallDimInput.style.boxShadow = '0 0 0 2px ' + _snapCss;

    const _midWorld = new THREE.Vector3(
      (wallStart.x + s.x) / 2,
      0,
      (wallStart.z + s.z) / 2
    );
    const _midScreen = _midWorld.clone().project(activeCamera);
    const _sx = (_midScreen.x *  0.5 + 0.5) * window.innerWidth;
    const _sy = (_midScreen.y * -0.5 + 0.5) * window.innerHeight;
    showWallDimInput(_sx, _sy, Math.round(wallStart.distanceTo(s) * 1000));
  
    dimLabel.style.display = 'none';
    return;
  }
  

  if (canvas._draggingHandle) {
    const pt = getFloorPos(e); if (!pt) return;
    const s = snapToGrid(pt);
    const handle = canvas._draggingHandle;
    const wallObj = handle.userData.wallObj;
    const idx = handle.userData.handleIndex;
    if (idx === 0) wallObj.start.copy(s);
    else wallObj.end.copy(s);
    handle.position.set(s.x, 0.08, s.z);
    scene.remove(wallObj.mesh);
    const dx = wallObj.end.x - wallObj.start.x;
    const dz = wallObj.end.z - wallObj.start.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length < mm(50)) return;
    const h = mm(settings.ceilingHeight), t = mm(settings.wallThickness);
    wallObj.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, h, t),
      new THREE.MeshStandardMaterial({ color: 0xff9500 })
    );
    wallObj.mesh.position.set(
      (wallObj.start.x + wallObj.end.x) / 2, h / 2,
      (wallObj.start.z + wallObj.end.z) / 2
    );
    wallObj.mesh.rotation.y = -Math.atan2(dz, dx);
    wallObj.mesh.castShadow = wallObj.mesh.receiveShadow = true;
    wallObj.mesh.userData.wallObj = wallObj;
    { const _op = (wallObj.opacity != null) ? wallObj.opacity : 1;
      wallObj.mesh.material.transparent = _op < 1;
      wallObj.mesh.material.opacity = _op; }
    scene.add(wallObj.mesh);
    return;
  }

  if (dragTarget) {
    const pt = getFloorPosFromRay(e);
    if (!pt) return;
    let s = snapToGrid(new THREE.Vector3(pt.x + dragOffset.x, 0, pt.z + dragOffset.z));
    const product = dragTarget.userData?.product;
    if (product) s = snapToWall(s, mm(product.depth));
    dragTarget.position.x = s.x;
    dragTarget.position.z = s.z;
  }

});

      
      canvas.addEventListener('click', (e) => {
        if (isPanning2D) return;
        if (mode === 'draw-wall') {
          const pt = getFloorPos(e); if (!pt) return;
          let s = snapToCorner(snapToGrid(pt));
          if (wallStart) {
            const _qdx = Math.abs(s.x - wallStart.x);
            const _qdz = Math.abs(s.z - wallStart.z);
            s = _qdx >= _qdz
              ? new THREE.Vector3(s.x, 0, wallStart.z)
              : new THREE.Vector3(wallStart.x, 0, s.z);
            s = snapToStartLine(s, firstPoint);   // align to chain start corner
          }
        

          if (!wallStart) {
            wallStart = s.clone(); firstPoint = s.clone();
          } else {
            if (firstPoint && s.distanceTo(firstPoint) < 0.2) {
              buildWall(wallStart, firstPoint);
              lockRoom(); cancelWallDraw();
            } else {
              if (wallDimLocked && wallDimLockedLen > 0) {
                const _ax = Math.abs(s.x - wallStart.x);
                const _az = Math.abs(s.z - wallStart.z);
                if (_ax >= _az) {
                  s = new THREE.Vector3(
                    wallStart.x + Math.sign(s.x - wallStart.x) * wallDimLockedLen,
                    0,
                    wallStart.z
                  );
                } else {
                  s = new THREE.Vector3(
                    wallStart.x,
                    0,
                    wallStart.z + Math.sign(s.z - wallStart.z) * wallDimLockedLen
                  );
                }
              }
              wallDimLocked    = false;
              wallDimLockedLen = 0;
              buildWall(wallStart, s);
              wallStart = s.clone();
              firstWallLocked = true;
            }
            
          }
          return;
        }
          if (mode === 'select') {
            closeWallStylePopup();          // a left-click commits & closes the style popup
            updateMouse(e);
            raycaster.setFromCamera(mouse, activeCamera);
            if (!is3D) {
              const labelHits = raycaster.intersectObjects(label2DObjects.map(l => l.mesh));
              if (labelHits.length > 0) {
                showLabelEditor(labelHits[0].object.userData.wallObj, e.clientX, e.clientY);
                return;
              }
            }
            const wallHits = raycaster.intersectObjects(walls.map(w => w.mesh))
            .filter(h => walls.includes(h.object.userData.wallObj));

            // Cabinet hit-test (raycast the meshes inside each placed item).
            const targets = [];
            placedItems.forEach(item => {
              if (item.userData?.type === 'door' || item.userData?.type === 'window') return;
              item.traverse(child => { if (child.isMesh) targets.push(child); });
            });
            const itemHits = raycaster.intersectObjects(targets, false);

            // Whichever is physically closer to the camera wins (cabinets sit in
            // front of the walls they're against, so they must be able to beat a wall).
            const wallDist = wallHits.length ? wallHits[0].distance : Infinity;
            const itemDist = itemHits.length ? itemHits[0].distance : Infinity;

            if (itemHits.length > 0 && itemDist <= wallDist) {
              let obj = itemHits[0].object;
              while (obj.parent && !placedItems.includes(obj)) obj = obj.parent;
              selectedItem = obj;
              if (IS_TOUCH) {
                if (isShiftModifierActive()) {
                  // Touch shift held: additive cabinet multi-select (no overlay popup)
                  selectCabinet(obj, true);
                  clearWallMultiSelect();
                } else {
                  showTouchOverlayAndPanel(obj);
                }
              } else {
                const additive = e.ctrlKey || e.metaKey;
                selectCabinet(obj, additive);     // cyan box; ctrl/cmd toggles multi-select
                clearWallMultiSelect();
                if (additive) hideDesktopItemPanel();
                else showDesktopItemPanel(obj);
              }
              return;
            }

            if (wallHits.length > 0) {
              const wHit = wallHits[0].object.userData.wallObj;
              // Ctrl/Cmd + click (desktop) OR touch + Shift → toggle wall in multi-selection.
              if (e.ctrlKey || e.metaKey || (IS_TOUCH && isShiftModifierActive())) {
                hideWallPopup();                        // closes single-select popup (resets colours)
                toggleWallMultiSelect(wHit);
                selectedWalls.forEach(w => w.mesh.material.color.set(WALL_MULTI_COLOR)); // re-assert
                return;
              }
              clearWallMultiSelect();                 // plain click → fresh single selection
              clearCabinetSelection();
              showWallPopup(wHit, e.clientX, e.clientY);
              return;
            }

            hideWallPopup();
            hideDesktopItemPanel();
            selectedItem = null;
            clearWallMultiSelect();
            clearCabinetSelection();
          }
        });

      
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Select mode: right-click a wall → open the Wall Style popup (colour + opacity).
        if (mode === 'select') {
          updateMouse(e);
          raycaster.setFromCamera(mouse, activeCamera);
          const wallHits = raycaster.intersectObjects(walls.map(w => w.mesh))
            .filter(h => walls.includes(h.object.userData.wallObj));
          if (wallHits.length) {
            openWallStylePopup(wallHits[0].object.userData.wallObj, e.clientX, e.clientY);
          }
          return;
        }
        // Free Draw: right-click exits the ruler first, then exits the mode (mirrors Escape).
        if (mode === 'draw-free') {
          if (fdRulerActive) fdRulerDeactivate();
          else cancelFreeDraw();
          return;
        }
        cancelWallDraw();
      });
      
      function cancelWallDraw() {
        // Task F: if we're actually in Free Draw, that mode owns its own cleanup
        // (and its own toolbar button). Delegate so the Free Draw button can't get stuck.
        if (mode === 'draw-free') { cancelFreeDraw(); return; }
        hideWallDimInput();
        wallStart = firstPoint = null;
        firstWallLocked = false;
        const btn = document.getElementById('btn-draw-wall');
        if (btn) { btn.style.background = ''; btn.style.color = ''; }
        if (previewLine) { scene.remove(previewLine); previewLine = null; }
        dimLabel.style.display  = 'none';
        closeHint.style.display = 'none';
        clearSnapGuides(); clearAxisGuides();
        mode = 'select';
        if (is3D) controls.enabled = true;   // restore camera that draw-wall locked (2D view toggle sets its own state)
        canvas.style.cursor = 'default';
        canvas.style.cursor = 'default';
        // Touch-only cleanup
        if (IS_TOUCH) {
          clearPreview();
          previewWallPoints = [];
          freehandRawPoints = [];
          twoPtPhase     = 0;
          twoPtStart     = null;
          drawModeActive = null;
          hideConfirmBar();
          hideDrawModeMenu();
          hidePresetPicker();
        }
      }
      
// ── Draw Mode Helpers ────────────────────────────────────

function showDrawModeMenu() {
  document.getElementById('draw-mode-menu').style.display = 'flex';
}
function hideDrawModeMenu() {
  document.getElementById('draw-mode-menu').style.display = 'none';
}
function showPresetPicker() {
  document.getElementById('draw-preset-picker').style.display = 'flex';
}
function hidePresetPicker() {
  document.getElementById('draw-preset-picker').style.display = 'none';
}
function showConfirmBar(hint) {
  document.getElementById('draw-confirm-hint').textContent = hint || 'Drag corners · ✓ to confirm';
  document.getElementById('draw-confirm-bar').style.display = 'flex';
}
function hideConfirmBar() {
  document.getElementById('draw-confirm-bar').style.display = 'none';
}

function clearPreview() {
  while (previewMeshGroup.children.length) {
    previewMeshGroup.remove(previewMeshGroup.children[0]);
  }
  draggingPreviewHdl = null;
}

function drawPreviewPolygon(pts) {
  clearPreview();
  if (pts.length < 2) return;

  // Shaded interior fill
  if (pts.length >= 3) {
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.z)));
    const geo   = new THREE.ShapeGeometry(shape);
    const fill  = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xff9500, transparent: true, opacity: 0.12,
      side: THREE.DoubleSide, depthWrite: false
    }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.02;
    fill.renderOrder = 10;
    previewMeshGroup.add(fill);
  }

  // Dotted outline
  const loop = [...pts, pts[0]];
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i], b = loop[i + 1];
    const dir    = new THREE.Vector3().subVectors(b, a);
    const len    = dir.length();
    const norm   = dir.clone().normalize();
    const segLen = 0.06, gapLen = 0.06;
    let t = 0;
    while (t < len) {
      const s = a.clone().addScaledVector(norm, t);
      const e = a.clone().addScaledVector(norm, Math.min(t + segLen, len));
      previewMeshGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(s.x, 0.03, s.z),
          new THREE.Vector3(e.x, 0.03, e.z)
        ]),
        new THREE.LineBasicMaterial({ color: 0xff9500, opacity: 0.9, transparent: true })
      ));
      t += segLen + gapLen;
    }
  }

  // Corner handles
  pts.forEach((pt, i) => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sphere.position.set(pt.x, 0.06, pt.z);
    sphere.userData.previewHandleIndex = i;
    previewMeshGroup.add(sphere);
  });
}
function makeCleanRect(pts) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  });
  const g = mm(settings.gridSize);
  minX = Math.round(minX / g) * g;
  maxX = Math.round(maxX / g) * g;
  minZ = Math.round(minZ / g) * g;
  maxZ = Math.round(maxZ / g) * g;
  return [
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 0, minZ),
    new THREE.Vector3(maxX, 0, maxZ),
    new THREE.Vector3(minX, 0, maxZ),
  ];
}

function isRoughlyRectangular(pts, tolerance) {
  if (tolerance === undefined) tolerance = mm(600);
  if (pts.length < 3 || pts.length > 8) return false;
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  });
  const corners = [
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 0, minZ),
    new THREE.Vector3(maxX, 0, maxZ),
    new THREE.Vector3(minX, 0, maxZ),
  ];
  return pts.every(p => corners.some(c => p.distanceTo(c) < tolerance));
}


function weldCorners(pts, tolerance) {
  if (tolerance === undefined) tolerance = mm(200);
  const out = pts.map(p => p.clone());

  // First pass — snap every point to grid
  for (let i = 0; i < out.length; i++) {
    out[i] = snapToGrid(out[i]);
  }

  // Second pass — weld X coordinates
  for (let i = 0; i < out.length; i++) {
    for (let j = 0; j < out.length; j++) {
      if (i === j) continue;
      if (Math.abs(out[i].x - out[j].x) < tolerance) {
        const avg = Math.round((out[i].x + out[j].x) / 2 / mm(100)) * mm(100);
        out[i].x = avg;
        out[j].x = avg;
      }
    }
  }

  // Third pass — weld Z coordinates
  for (let i = 0; i < out.length; i++) {
    for (let j = 0; j < out.length; j++) {
      if (i === j) continue;
      if (Math.abs(out[i].z - out[j].z) < tolerance) {
        const avg = Math.round((out[i].z + out[j].z) / 2 / mm(100)) * mm(100);
        out[i].z = avg;
        out[j].z = avg;
      }
    }
  }

  return out;
}


function orthogonalisePoints(rawPts) {
  if (rawPts.length < 2) return rawPts;
  const out = [rawPts[0].clone()];
  for (let i = 1; i < rawPts.length; i++) {
    const prev = out[out.length - 1];
    const curr = rawPts[i];
    const dx = Math.abs(curr.x - prev.x);
    const dz = Math.abs(curr.z - prev.z);
    out.push(dx >= dz
      ? new THREE.Vector3(curr.x, 0, prev.z)
      : new THREE.Vector3(prev.x, 0, curr.z)
    );
  }
  return out;
}

function confirmPreviewWalls() {
  controls.enabled = true;
  if (previewWallPoints.length < 2) return;
  const pts = previewWallPoints;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.distanceTo(b) > mm(50)) buildWall(a.clone(), b.clone());
  }
  lockRoom();
  clearPreview();
  previewWallPoints = [];
  hideConfirmBar();
  cancelWallDraw();
}

function abortPreviewWalls() {
  controls.enabled = true;
  clearPreview();
  previewWallPoints = [];
  freehandRawPoints = [];
  twoPtPhase        = 0;
  twoPtStart        = null;
  drawModeActive    = null;
  hideConfirmBar();
  hidePresetPicker();
  hideDrawModeMenu();
  cancelWallDraw();
}

function drawPresetThumbnails() {
  const rectCvs = document.getElementById('dpp-rect-cvs');
  const lCvs    = document.getElementById('dpp-lshape-cvs');
  if (!rectCvs || !lCvs) return;

  const rCtx = rectCvs.getContext('2d');
  rCtx.fillStyle = '#1a1a1a';
  rCtx.fillRect(0, 0, 80, 80);
  rCtx.strokeStyle = '#ff9500';
  rCtx.lineWidth = 2;
  rCtx.strokeRect(10, 10, 60, 60);
  rCtx.fillStyle = 'rgba(255,149,0,0.15)';
  rCtx.fillRect(10, 10, 60, 60);

  const lCtx = lCvs.getContext('2d');
  lCtx.fillStyle = '#1a1a1a';
  lCtx.fillRect(0, 0, 80, 80);
  lCtx.strokeStyle = '#ff9500';
  lCtx.lineWidth = 2;
  lCtx.beginPath();
  lCtx.moveTo(10, 10); lCtx.lineTo(70, 10); lCtx.lineTo(70, 42);
  lCtx.lineTo(44, 42); lCtx.lineTo(44, 70); lCtx.lineTo(10, 70);
  lCtx.closePath();
  lCtx.stroke();
  lCtx.fillStyle = 'rgba(255,149,0,0.15)';
  lCtx.fill();
}

drawPresetThumbnails();

      
      canvas.addEventListener('mouseup', () => {
        if (canvas._draggingHandle) {
          const wallObj = canvas._draggingHandle.userData.wallObj;
          canvas._draggingHandle = null;
          controls.enabled = true;
          rebuildAllCaps();
          refreshAll2DLabels();
          rebuild2DWallOverlays();
          showWallHandles(wallObj);
          updateRoomArea();
          return;
        }
      
        if (dragTarget && dragStartPos) {
          const endPos = dragTarget.position.clone();
          if (endPos.distanceTo(dragStartPos) > 0.001) {
            pushHistory({ type: 'move-item', data: { mesh: dragTarget, from: dragStartPos.clone(), to: endPos.clone() } });
          }
        }
        dragTarget = null; dragStartPos = null;
        controls.enabled = true;
      });
      
      // ✅ FIX: Product wall snapping — snaps item to nearest wall face when close enough
      function snapToWall(pos, itemDepth) {
        const snapDist = 0.3;
        let best = null, bestDist = snapDist;
        walls.forEach(w => {
          const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len < 0.001) return;
          const nx = dx / len, nz = dz / len;
          // perpendicular (inward normal)
          const px = -nz, pz = nx;
          // project pos onto wall line
          const tx = pos.x - w.start.x, tz = pos.z - w.start.z;
          const along = tx * nx + tz * nz;
          if (along < 0 || along > len) return;
          const perpDist = tx * px + tz * pz;
          const wallFaceDist = mm(settings.wallThickness) / 2 + itemDepth / 2;
          if (Math.abs(Math.abs(perpDist) - wallFaceDist) < bestDist) {
            bestDist = Math.abs(Math.abs(perpDist) - wallFaceDist);
            const sign = perpDist >= 0 ? 1 : -1;
            best = new THREE.Vector3(
              w.start.x + nx * along + px * sign * wallFaceDist,
              pos.y,
              w.start.z + nz * along + pz * sign * wallFaceDist
            );
          }
        });
        return best || pos;
      }
document.getElementById('btn-draw-wall').addEventListener('click', () => {
  if (mode === 'draw-free') cancelFreeDraw();   // Task F: leaving Free Draw clears its button
  const inDrawMode = ['draw-wall','draw-preset','draw-freehand','draw-twopoint','draw-glide'].includes(mode);
  if (inDrawMode) {
    abortPreviewWalls();
  } else {
    hideWallPopup();
    showDrawModeMenu();
  }
});

      
      
      
      document.getElementById('btn-toggle-view').addEventListener('click', () => {
        cancelWallDraw();
        is3D = !is3D;      
        if (is3D) {
          activeCamera = camera3D; controls.enabled = true;
        } else {
          // ✅ FIX: only reset camera position on very first switch to 2D
          if (!camera2D.userData.initialised) {
            camera2D.position.set(0, 50, 0);
            camera2D.up.set(0, 0, -1);
            camera2D.lookAt(0, 0, 0);
            camera2D.userData.initialised = true;
          }
          updateOrtho();
          activeCamera = camera2D; controls.enabled = false;
        }
        document.getElementById('btn-toggle-view').textContent = is3D ? '2D' : '3D';
        update2DLabelVisibility();
        rebuild2DWallOverlays();
      });
      
      document.getElementById('btn-undo')?.addEventListener('click', applyUndo);
      document.getElementById('btn-redo')?.addEventListener('click', applyRedo);
      updateUndoRedoButtons();
      
      // ✅ FIX: room-area display element — add <div id="room-area"> to your index.html
      // e.g. inside your toolbar: <div id="room-area" style="color:#aaa;font-size:12px;padding:4px 8px;"></div>
      
// Shopify Storefront API config
const SHOPIFY_DOMAIN = '3gxvcz-k1.myshopify.com';
const SHOPIFY_API_VERSION = '2025-01';
const SHOPIFY_STOREFRONT_TOKEN = '8f60ecff0fa31849feea742394c42139';
const SHOPIFY_ENDPOINT = 'https://' + SHOPIFY_DOMAIN + '/api/' + SHOPIFY_API_VERSION + '/graphql.json';

async function shopifyFetch(query, variables) {
  if (!variables) variables = {};
  const res = await fetch(SHOPIFY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN
    },
    body: JSON.stringify({ query: query, variables: variables })
  });
  if (!res.ok) throw new Error('Shopify ' + res.status);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(function(e){return e.message;}).join('; '));
  return json.data;
}

   
// ── Shopify product fetch ─────────────────────────────────────────────────────
let products = [];
const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          productType
          glb_url:   metafield(namespace: "planner", key: "glb_url")   { value }
          width_mm:  metafield(namespace: "planner", key: "width_mm")  { value }
          height_mm: metafield(namespace: "planner", key: "height_mm") { value }
          depth_mm:  metafield(namespace: "planner", key: "depth_mm")  { value }
          category:  metafield(namespace: "planner", key: "category")  { value }
          variants(first: 50) {
            edges {
              node {
                id title sku availableForSale
                price { amount currencyCode }
              }
            }
          }
        }
      }
    }
  }
`;

const nzPrice = amount => 'NZ$' + parseFloat(amount).toFixed(2);

function shopifyNodeToProduct(node) {
  const width  = parseInt(node.width_mm?.value)  || 600;
  const height = parseInt(node.height_mm?.value) || 720;
  const depth  = parseInt(node.depth_mm?.value)  || 580;
  const glbUrl = node.glb_url?.value || null;

  const variants = node.variants.edges.map(e => e.node);
  const skus = variants.map(v => ({
    id:           v.sku || v.id,
    label:        v.title === 'Default Title' ? 'Standard' : v.title,
    price:        parseFloat(v.price.amount),
    priceDisplay: nzPrice(v.price.amount),
    variantId:    v.id,
    available:    v.availableForSale
  }));

  return {
    id:          node.handle,
    shopifyId:   node.id,
    name:        node.title,
    productType: node.productType || 'Other',
    category:    node.category?.value || node.productType || 'Other',
    modelPath:   glbUrl,
    width, height, depth,
    skus: skus.length ? skus : [{ id: node.handle, label: 'Standard', price: 0, priceDisplay: 'NZ$0.00', available: false }]
  };
}

async function fetchAllShopifyProducts() {
  const all = [];
  let cursor = null;
  for (let i = 0; i < 10; i++) {
    const data = await shopifyFetch(PRODUCTS_QUERY, { cursor });
    data.products.edges.forEach(e => all.push(e.node));
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return all;
}

function renderProductPanel() {
  const productList = document.getElementById('product-list');
  productList.innerHTML = '';

  if (products.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px;color:#888;font-size:13px;text-align:center';
    empty.textContent = 'No products available.';
    productList.appendChild(empty);
    return;
  }

  const groups = new Map();
  products.forEach(p => {
    const key = p.productType || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  Array.from(groups.keys()).sort().forEach(groupName => {
    const header = document.createElement('div');
    header.style.cssText = 'padding:10px 12px 6px;color:#ff9500;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid #2a2a2a;margin-top:4px';
    header.textContent = groupName;
    productList.appendChild(header);

    groups.get(groupName).sort((a, b) => a.name.localeCompare(b.name)).forEach(product => {
      const div = document.createElement('div');
      div.className = 'product-item';
      const priceFrom = product.skus.length
        ? nzPrice(Math.min(...product.skus.map(s => s.price)))
        : '';
      div.innerHTML =
        '<div style="font-weight:600">' + product.name + '</div>' +
        '<div style="font-size:11px;color:#aaa;margin-top:2px">' +
          product.width + ' × ' + product.depth + ' × ' + product.height + 'mm' +
          (priceFrom ? ' · from ' + priceFrom : '') +
        '</div>' +
        (product.modelPath ? '' :
          '<div style="font-size:10px;color:#666;margin-top:2px">⬜ placeholder model</div>');
      div.addEventListener('click', () => {
        placeProduct(product);
        if (window.innerWidth <= 768) closeProductPanel();
      });
      productList.appendChild(div);
    });
  });
}

async function loadShopifyProducts() {
  const productList = document.getElementById('product-list');
  productList.innerHTML =
    '<div style="padding:16px;color:#888;font-size:13px;text-align:center">Loading products…</div>';

  try {
    const nodes = await fetchAllShopifyProducts();
    products = nodes
      .filter(n => !/\(Draft\)/i.test(n.title))
      .map(shopifyNodeToProduct);
    console.log('Loaded', products.length, 'products from Shopify');
    renderProductPanel();
  } catch (err) {
    console.error('Shopify product load failed:', err);
    productList.innerHTML =
      '<div style="padding:16px;color:#c0392b;font-size:13px;text-align:center">' +
      'Failed to load products.<br><span style="font-size:11px;color:#888">' +
      (err.message || 'Check console') + '</span></div>';
  }
}

loadShopifyProducts();

      
      function placeProduct(product) {
        const w = mm(product.width), h = mm(product.height), d = mm(product.depth);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: 0x8B7355 })
        );
        mesh.position.set(0, h / 2, 0);
        mesh.castShadow = true;
        mesh.userData = { product, skuIndex: 0 };
        scene.add(mesh);
        placedItems.push(mesh);
        pushHistory({ type: 'add-item', data: { mesh } });
        updateQuote();
        // ✅ FIX: load GLB model to replace placeholder if modelPath is set
        loadProductModel(product, mesh);
      }
      
      function updateQuote() {
        const itemList = document.getElementById('item-list');
        const totalEl  = document.getElementById('total-price');
        itemList.innerHTML = '';
        let total = 0;
        placedItems.forEach(obj => {
          if (!obj.userData?.product?.skus) return;
          const { product, skuIndex } = obj.userData;
          const sku = product.skus[skuIndex];
          total += sku.price;
          const div = document.createElement('div');
          div.className = 'quote-item';
          div.innerHTML = '<strong>' + product.name + '</strong><br>' + sku.label + ' - $' + sku.price.toFixed(2);
          itemList.appendChild(div);
        });
        totalEl.textContent = '$' + total.toFixed(2);
      }
      
      window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera3D.aspect = window.innerWidth / window.innerHeight;
        camera3D.updateProjectionMatrix();
        updateOrtho();
        if (elevationPanel.style.display !== 'none') { resizeElevCanvas(); drawElevation(); }
      });
      
    
      function animate() {
        requestAnimationFrame(animate);
        controls.update();
        updateCabinetBoxes();
        renderer.render(scene, activeCamera);
      }
      // ── GLB Import — button + drag-and-drop ──────────────────────────────────────

const glbFileInput = document.getElementById('glb-file-input');

const dropOverlay = document.createElement('div');
dropOverlay.style.cssText = [
  'display:none;position:fixed;inset:0;z-index:900;',
  'background:rgba(0,0,0,0.72);',
  'border:3px dashed #ff9500;',
  'align-items:center;justify-content:center;',
  'flex-direction:column;gap:12px;pointer-events:all;cursor:copy;'
].join('');

dropOverlay.innerHTML = [
  '<div style="font-size:48px">📦</div>',
  '<div style="color:#ff9500;font-size:22px;font-weight:bold;font-family:Arial">Drop GLB / GLTF to import</div>',
  '<div style="color:#aaa;font-size:13px;font-family:Arial">File name becomes the product name</div>'
].join('');
document.body.appendChild(dropOverlay);

function showDropOverlay() { dropOverlay.style.display = 'flex'; }
function hideDropOverlay() { dropOverlay.style.display = 'none'; }

let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (e.dataTransfer.types.includes('Files')) {
    dragCounter++;
    showDropOverlay();
  }
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; hideDropOverlay(); }
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  hideDropOverlay();
  const files = Array.from(e.dataTransfer.files).filter(f =>
    f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf')
  );
  if (files.length === 0) return;
  files.forEach(loadGlbFile);
});
// GLB import triggered via hamburger menu (#hmenu-import-glb → glbFileInput)
glbFileInput.addEventListener('change', () => {
  Array.from(glbFileInput.files).forEach(loadGlbFile);
  glbFileInput.value = '';
});

function centreAndFloor(model) {
  const box = new THREE.Box3().setFromObject(model);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= box.min.y;
}

function loadGlbFile(file) {
  const url = URL.createObjectURL(file);
  gltfLoader.load(
    url,
    (gltf) => {
      URL.revokeObjectURL(url);
      glbModalFile  = file;
      glbModalGltf  = gltf;
      glbModalScene = gltf.scene.clone(true);

      // Auto-scale to fit inside 1m cube
      const box = new THREE.Box3().setFromObject(glbModalScene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0.001) glbModalScene.scale.setScalar(1 / maxDim);

      centreAndFloor(glbModalScene);

      // Measure after scale
      const box2  = new THREE.Box3().setFromObject(glbModalScene);
      const size2 = new THREE.Vector3();
      box2.getSize(size2);
      glbOriginalSize.copy(size2);

      // Pre-fill inputs
      document.getElementById('glb-w').value = Math.round(size2.x * 1000);
      document.getElementById('glb-h').value = Math.round(size2.y * 1000);
      document.getElementById('glb-d').value = Math.round(size2.z * 1000);
      document.getElementById('glb-detected-size').textContent =
        'Detected: ' + Math.round(size2.x * 1000) + ' × ' +
        Math.round(size2.y * 1000) + ' × ' +
        Math.round(size2.z * 1000) + 'mm';
      document.getElementById('glb-modal-name').textContent = file.name;
      document.getElementById('glb-backplane').checked = false;

      glbModalOpen();
      setTimeout(() => startGlbPreview(glbModalScene), 80);
    },
    undefined,
    (err) => {
      URL.revokeObjectURL(url);
      console.error('GLB import failed:', err);
      showImportToast('Failed to load ' + file.name, true);
    }
  );
}


const importedSceneCache = new Map();

function addImportedProductToPanel(product) {
  if (document.getElementById('imported-' + product.id)) return;

  const div = document.createElement('div');
  div.className = 'product-item';
  div.id = 'imported-' + product.id;
  div.innerHTML = '<span style="font-size:11px;color:#ff9500;margin-right:4px">GLB</span>' + product.name;

  div.addEventListener('click', () => {
    const original = importedSceneCache.get(product.id);
    if (!original) return;
    const clone = original.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.set(0, -box.min.y, 0);
    clone.userData = { product, skuIndex: 0 };
    clone.traverse(child => {
      if (child.isMesh) { child.castShadow = true; child.userData = clone.userData; }
    });
    scene.add(clone);
    placedItems.push(clone);
    pushHistory({ type: 'add-item', data: { mesh: clone } });
    updateQuote();
  });

  document.getElementById('product-list').appendChild(div);
}

function showImportToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
    'background:' + (isError ? '#c0392b' : '#2ecc71') + ';',
    'color:#fff;padding:10px 20px;border-radius:8px;',
    'font:bold 13px Arial;z-index:9999;',
    'box-shadow:0 4px 16px rgba(0,0,0,0.4);',
    'transition:opacity 0.4s;pointer-events:none;'
  ].join('');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  setTimeout(() => { toast.remove(); }, 3000);
}
// ── GLB Setup Modal ───────────────────────────────────────────────────────────

const glbModal      = document.getElementById('glb-setup-modal');
const glbStep1      = document.getElementById('glb-step-1');
const glbStep2      = document.getElementById('glb-step-2');
const glbPreviewCvs = document.getElementById('glb-preview-canvas');
const glbPhotoCvs   = document.getElementById('glb-photo-canvas');

function glbModalOpen() {
  glbModal.style.display = 'flex';
  glbStep1.style.display = 'block';
  glbStep2.style.display = 'none';
}
function glbModalClose() {
  glbModal.style.display = 'none';
  stopGlbPreview();
  stopGlbPhoto();
  glbModalScene = null;
  glbModalFile  = null;
  glbModalGltf  = null;
}
// ✅ FIX 1: dispose geometries, materials, and textures before dropping the renderer
function disposeModel(model) {
  if (!model) return;
  model.traverse(child => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach(m => {
      // dispose any texture slots on the material
      Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
      m.dispose();
    });
  });
}

function stopGlbPreview() {
  if (glbPreviewAnimId) { cancelAnimationFrame(glbPreviewAnimId); glbPreviewAnimId = null; }
  if (glbPreviewCvs._previewModel) disposeModel(glbPreviewCvs._previewModel);
  if (glbPreviewRenderer) { glbPreviewRenderer.dispose(); glbPreviewRenderer = null; }
  glbPreviewCvs._previewModel = null;
  glbPreviewCvs._previewScene = null;
}
function stopGlbPhoto() {
  if (glbPhotoAnimId) { cancelAnimationFrame(glbPhotoAnimId); glbPhotoAnimId = null; }
  if (glbPhotoCvs._photoModel) disposeModel(glbPhotoCvs._photoModel);
  if (glbPhotoRenderer) { glbPhotoRenderer.dispose(); glbPhotoRenderer = null; }
  glbPhotoCvs._photoModel = null;
  glbPhotoCvs._photoScene = null;
}


function fitCameraToModel(camera, model, offsetMult = 1.6) {
  const box  = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov    = camera.fov * (Math.PI / 180);
  let dist     = (maxDim / 2) / Math.tan(fov / 2);
  dist        *= offsetMult;
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  camera.position.set(centre.x + dist * 0.6, centre.y + dist * 0.5, centre.z + dist * 0.8);
  camera.lookAt(centre);
  if (glbPreviewControls) glbPreviewControls.target.copy(centre);
  if (glbPhotoControls)   glbPhotoControls.target.copy(centre);
}

function startGlbPreview(model) {
  stopGlbPreview();
  const W = glbPreviewCvs.offsetWidth  || 468;
  const H = glbPreviewCvs.offsetHeight || 260;
  glbPreviewCvs.width  = W * window.devicePixelRatio;
  glbPreviewCvs.height = H * window.devicePixelRatio;

  glbPreviewRenderer = new THREE.WebGLRenderer({ canvas: glbPreviewCvs, antialias: true, alpha: true });
  glbPreviewRenderer.setPixelRatio(window.devicePixelRatio);
  glbPreviewRenderer.setSize(W, H);

  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x111111);
  previewScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(3, 6, 4);
  previewScene.add(dl);
  previewScene.add(new THREE.GridHelper(4, 20, 0x2a2a2a, 0x2a2a2a));

  glbPreviewCamera = new THREE.PerspectiveCamera(45, W / H, 0.001, 500);
  glbPreviewControls = new OrbitControls(glbPreviewCamera, glbPreviewCvs);
  glbPreviewControls.enableDamping = true;

  const clone = model.clone(true);
  clone.traverse(child => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.side = THREE.DoubleSide; });
    }
  });
  previewScene.add(clone);
  fitCameraToModel(glbPreviewCamera, clone);
  glbPreviewControls.update();
  updateBackPlaneVisual(clone);

  glbPreviewCvs._previewScene = previewScene;
  glbPreviewCvs._previewModel = clone;

  let dragActive = false, lastX = 0, lastY = 0;

  glbPreviewCvs.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragActive = true;
    lastX = e.clientX;
    lastY = e.clientY;
    glbPreviewControls.enabled = false;
  });
  function onPreviewMouseMove(e) {
    if (!dragActive) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    clone.rotation.y += dx * 0.01;
    clone.rotation.x += dy * 0.01;
    const box2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= box2.min.y;
    updateBackPlaneVisual(clone);
  }
  function onPreviewMouseUp() {
    if (!dragActive) return;
    dragActive = false;
    glbPreviewControls.enabled = true;
  }
  
  window.addEventListener('mousemove', onPreviewMouseMove);
  window.addEventListener('mouseup',   onPreviewMouseUp);
  
  glbPreviewCvs._onMouseMove = onPreviewMouseMove;
  glbPreviewCvs._onMouseUp   = onPreviewMouseUp;
  

  glbPreviewCvs.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      dragActive = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      glbPreviewControls.enabled = false;
    }
  }, { passive: true });
  glbPreviewCvs.addEventListener('touchmove', (e) => {
    if (!dragActive || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    clone.rotation.y += dx * 0.01;
    clone.rotation.x += dy * 0.01;
    const box2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= box2.min.y;
    updateBackPlaneVisual(clone);
  }, { passive: true });
  glbPreviewCvs.addEventListener('touchend', () => {
    dragActive = false;
    glbPreviewControls.enabled = true;
  }, { passive: true });

  function loop() {
    glbPreviewAnimId = requestAnimationFrame(loop);
    glbPreviewControls.update();
    glbPreviewRenderer.render(previewScene, glbPreviewCamera);
  }
  loop();
}


function updateBackPlaneVisual(modelClone) {
  const old = modelClone.getObjectByName('__backplane__');
  if (old) modelClone.remove(old);
  if (!document.getElementById('glb-backplane').checked) return;

  const box = new THREE.Box3().setFromObject(modelClone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  const localCentre = centre.clone().sub(modelClone.position);
  const localBackZ  = box.max.z - modelClone.position.z;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x, size.y),
    new THREE.MeshBasicMaterial({
      color: 0xff9500, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  plane.name = '__backplane__';
  plane.position.set(localCentre.x, localCentre.y, localBackZ);
  modelClone.add(plane);
}



document.getElementById('glb-backplane').addEventListener('change', () => {
  const clone = glbPreviewCvs._previewModel;
  if (clone) updateBackPlaneVisual(clone);
});

document.querySelectorAll('.glb-rot-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!glbModalScene) return;
    const axis = btn.dataset.axis;
    const rad  = THREE.MathUtils.degToRad(parseFloat(btn.dataset.deg));
    if (axis === 'x') glbModalScene.rotateX(rad);
    if (axis === 'y') glbModalScene.rotateY(rad);
    if (axis === 'z') glbModalScene.rotateZ(rad);
    centreAndFloor(glbModalScene);
    const clone = glbPreviewCvs._previewModel;
    if (clone) {
      clone.rotation.copy(glbModalScene.rotation);
      centreAndFloor(clone);
      updateBackPlaneVisual(clone);
    }
    updateDetectedSize();
  });
});

document.querySelectorAll('.glb-flip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!glbModalScene) return;
    const axis = btn.dataset.axis;

    // Flip around the model's centre, then re-floor it
    const box = new THREE.Box3().setFromObject(glbModalScene);
    const centre = new THREE.Vector3();
    box.getCenter(centre);

    // Move origin to centre, flip, move back
    glbModalScene.position.sub(centre);
    if (axis === 'x') glbModalScene.scale.x *= -1;
    if (axis === 'y') glbModalScene.scale.y *= -1;
    if (axis === 'z') glbModalScene.scale.z *= -1;
    glbModalScene.position.add(centre);

    // Re-floor: ensure bottom sits at y=0
    const box2 = new THREE.Box3().setFromObject(glbModalScene);
    glbModalScene.position.y -= box2.min.y;    
    glbModalScene.traverse(child => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { m.side = THREE.DoubleSide; });
      }
    });


    const clone = glbPreviewCvs._previewModel;
    if (clone) {
      clone.scale.copy(glbModalScene.scale);
      clone.position.copy(glbModalScene.position);

      clone.traverse(child => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { m.side = THREE.DoubleSide; });
        }
      });

      updateBackPlaneVisual(clone);

    }
    updateDetectedSize();
  });
});

document.getElementById('glb-apply-scale').addEventListener('click', () => {
  if (!glbModalScene) return;
  const wM = mm(parseFloat(document.getElementById('glb-w').value) || 1);
  const hM = mm(parseFloat(document.getElementById('glb-h').value) || 1);
  const dM = mm(parseFloat(document.getElementById('glb-d').value) || 1);
  const box  = new THREE.Box3().setFromObject(glbModalScene);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x < 0.0001 || size.y < 0.0001 || size.z < 0.0001) return;
  const lock = document.getElementById('glb-measure-lock').checked;
  if (lock) {
    const s = hM / size.y;
    glbModalScene.scale.multiplyScalar(s);
  } else {
    glbModalScene.scale.x *= wM / size.x;
    glbModalScene.scale.y *= hM / size.y;
    glbModalScene.scale.z *= dM / size.z;
  }
  centreAndFloor(glbModalScene);
  const clone = glbPreviewCvs._previewModel;
  if (clone) {
    clone.scale.copy(glbModalScene.scale);
    centreAndFloor(clone);
    fitCameraToModel(glbPreviewCamera, clone);
    glbPreviewControls.update();
    updateBackPlaneVisual(clone);
  }
  updateDetectedSize();
});

function updateDetectedSize() {
  if (!glbModalScene) return;
  const box  = new THREE.Box3().setFromObject(glbModalScene);
  const size = new THREE.Vector3();
  box.getSize(size);
  document.getElementById('glb-detected-size').textContent =
    'Detected: ' + Math.round(size.x * 1000) + ' × ' +
    Math.round(size.y * 1000) + ' × ' +
    Math.round(size.z * 1000) + 'mm';
}

document.getElementById('glb-step1-next').addEventListener('click', () => {
  glbStep1.style.display = 'none';
  glbStep2.style.display = 'block';
  startGlbPhoto();
});
document.getElementById('glb-step2-back').addEventListener('click', () => {
  stopGlbPhoto();
  glbStep2.style.display = 'none';
  glbStep1.style.display = 'block';
});
document.getElementById('glb-step1-cancel').addEventListener('click', glbModalClose);

function startGlbPhoto() {
  stopGlbPhoto();
  const W = glbPhotoCvs.offsetWidth  || 468;
  const H = glbPhotoCvs.offsetHeight || 340;
  glbPhotoCvs.width  = W * window.devicePixelRatio;
  glbPhotoCvs.height = H * window.devicePixelRatio;

  glbPhotoRenderer = new THREE.WebGLRenderer({ canvas: glbPhotoCvs, antialias: true, preserveDrawingBuffer: true });
  glbPhotoRenderer.setPixelRatio(window.devicePixelRatio);
  glbPhotoRenderer.setSize(W, H);
  glbPhotoRenderer.setClearColor(0x1a1a1a);

  const photoScene = new THREE.Scene();
  photoScene.background = new THREE.Color(0x1a1a1a);
  photoScene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl1 = new THREE.DirectionalLight(0xffffff, 1.2);
  dl1.position.set(4, 8, 5); photoScene.add(dl1);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dl2.position.set(-4, 2, -3); photoScene.add(dl2);

  glbPhotoCamera = new THREE.PerspectiveCamera(45, W / H, 0.001, 500);
  glbPhotoControls = new OrbitControls(glbPhotoCamera, glbPhotoCvs);
  glbPhotoControls.enableDamping = true;

  const clone = glbModalScene.clone(true);
  clone.traverse(child => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { m.side = THREE.DoubleSide; });
    }
  });

  photoScene.add(clone);
  setIsoView(glbPhotoCamera, clone);
  glbPhotoControls.target.set(0, 0, 0);
  glbPhotoControls.update();

  glbPhotoCvs._photoScene = photoScene;
  glbPhotoCvs._photoModel = clone;

  function loop() {
    glbPhotoAnimId = requestAnimationFrame(loop);
    glbPhotoControls.update();
    glbPhotoRenderer.render(photoScene, glbPhotoCamera);
  }
  loop();
}

function setIsoView(cam, model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  const d = Math.max(size.x, size.y, size.z) * 2;
  cam.position.set(centre.x + d, centre.y + d * 0.8, centre.z + d);
  cam.lookAt(centre);
  if (glbPhotoControls) { glbPhotoControls.target.copy(centre); glbPhotoControls.update(); }
}

document.getElementById('glb-iso-view').addEventListener('click', () => {
  if (glbPhotoCamera && glbPhotoCvs._photoModel) setIsoView(glbPhotoCamera, glbPhotoCvs._photoModel);
});
document.getElementById('glb-front-view').addEventListener('click', () => {
  if (!glbPhotoCamera || !glbPhotoCvs._photoModel) return;
  const box = new THREE.Box3().setFromObject(glbPhotoCvs._photoModel);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  const d = Math.max(size.x, size.y, size.z) * 2;
  glbPhotoCamera.position.set(centre.x, centre.y, centre.z + d);
  glbPhotoCamera.lookAt(centre);
  glbPhotoControls.target.copy(centre); glbPhotoControls.update();
});
document.getElementById('glb-side-view').addEventListener('click', () => {
  if (!glbPhotoCamera || !glbPhotoCvs._photoModel) return;
  const box = new THREE.Box3().setFromObject(glbPhotoCvs._photoModel);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  const d = Math.max(size.x, size.y, size.z) * 2;
  glbPhotoCamera.position.set(centre.x + d, centre.y, centre.z);
  glbPhotoCamera.lookAt(centre);
  glbPhotoControls.target.copy(centre); glbPhotoControls.update();
});
document.getElementById('glb-top-view').addEventListener('click', () => {
  if (!glbPhotoCamera || !glbPhotoCvs._photoModel) return;
  const box = new THREE.Box3().setFromObject(glbPhotoCvs._photoModel);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  const d = Math.max(size.x, size.y, size.z) * 2;
  glbPhotoCamera.position.set(centre.x, centre.y + d, centre.z + 0.001);
  glbPhotoCamera.lookAt(centre);
  glbPhotoControls.target.copy(centre); glbPhotoControls.update();
});

document.getElementById('glb-upload-btn').addEventListener('click', () => {
  if (!glbModalScene || !glbModalGltf) return;
  const thumbnail = glbPhotoCvs.toDataURL('image/png');
  const box  = new THREE.Box3().setFromObject(glbModalScene);
  const size = new THREE.Vector3(); box.getSize(size);
  const name = glbModalFile.name.replace(/\.(glb|gltf)$/i, '');

  const syntheticProduct = {
    id:          'imported-' + Date.now(),
    name,
    modelPath:   null,
    thumbnail,
    width:       Math.round(size.x * 1000),
    height:      Math.round(size.y * 1000),
    depth:       Math.round(size.z * 1000),
    hasBackPlane: document.getElementById('glb-backplane').checked,
    skus: [{ id: 'imported', label: 'Imported', price: 0 }]
  };

  const finalModel = glbModalScene.clone(true);
  centreAndFloor(finalModel);
  finalModel.traverse(child => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        m.side = THREE.DoubleSide;
        Object.values(m).forEach(v => {
          if (v?.isTexture) {
            v.anisotropy = renderer.capabilities.getMaxAnisotropy();
            v.needsUpdate = true;
          }
        });
      });
    }
  });
  

  finalModel.userData = { product: syntheticProduct, skuIndex: 0 };
  finalModel.traverse(child => {
    if (child.isMesh) { child.castShadow = true; child.userData = finalModel.userData; }
  });

  scene.add(finalModel);
  placedItems.push(finalModel);
  pushHistory({ type: 'add-item', data: { mesh: finalModel } });
  updateQuote();

  importedSceneCache.set(syntheticProduct.id, glbModalScene.clone(true));
  addImportedProductToPanel(syntheticProduct);
  showImportToast(name + ' imported (' +
    syntheticProduct.width + ' × ' +
    syntheticProduct.height + ' × ' +
    syntheticProduct.depth + 'mm)');

  glbModalClose();
});
// ✅ FIX 2: export quote as CSV
document.getElementById('btn-export').addEventListener('click', () => {
  const lines = ['Product,Variant,Price'];
  let total = 0;
  placedItems.forEach(obj => {
    if (!obj.userData?.product?.skus) return;
    const { product, skuIndex } = obj.userData;
    const sku = product.skus[skuIndex ?? 0];
    lines.push(`"${product.name}","${sku.label}",${sku.price.toFixed(2)}`);
    total += sku.price;
  });
  lines.push(`"","Total","${total.toFixed(2)}"`);
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kitchen-quote.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  setTimeout(() => {
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, 0);
});


// ── Bottom overlay bar ──
const touchOverlay     = document.getElementById('touch-model-overlay');
const touchRotateBtn   = document.getElementById('touch-rotate-btn');
const touchDragBtn     = document.getElementById('touch-drag-btn');
const touchDeselectBtn = document.getElementById('touch-deselect-btn');

// ── Floating panel ──
const floatPanel       = document.getElementById('touch-float-panel');
const floatHandle      = document.getElementById('touch-float-handle');
const floatClose       = document.getElementById('touch-float-close');
const tfpDuplicate     = document.getElementById('tfp-duplicate');
const tfpRuler         = document.getElementById('tfp-ruler');
const tfpDelete        = document.getElementById('tfp-delete');
const tfpHide          = document.getElementById('tfp-hide');
const tfpRulerReadout  = document.getElementById('tfp-ruler-readout');
const tfpRulerText     = document.getElementById('tfp-ruler-text');

let touchSelectedModel  = null;
let touchDragActive     = false;
let floatPanelDragging  = false;
let floatDragOffsetX    = 0;
let floatDragOffsetY    = 0;
let rulerActive         = false;

function showTouchOverlay(model) {
  touchSelectedModel = model;
  touchOverlay.style.display = 'block';
}

function hideTouchOverlay() {
  touchSelectedModel = null;
  touchOverlay.style.display = 'none';
  touchDragActive = false;
  touchDragBtn.textContent = '✋ Hold & Drag';
  touchDragBtn.style.background = 'rgba(255,255,255,0.1)';
}

function showFloatPanel(model) {
  floatPanel.style.display = 'block';
  rulerActive = false;
  tfpRuler.classList.remove('tfp-btn-active');
  tfpRulerReadout.style.display = 'none';
  const isHidden = !model.visible;
  tfpHide.textContent = isHidden ? '👁 Show' : '👁 Hide';
  isHidden ? tfpHide.classList.add('tfp-btn-hidden')
           : tfpHide.classList.remove('tfp-btn-hidden');
}

function hideFloatPanel() {
  floatPanel.style.display = 'none';
  rulerActive = false;
  tfpRulerReadout.style.display = 'none';
}

function showTouchOverlayAndPanel(model) {
  showTouchOverlay(model);
  showFloatPanel(model);
}

function getFloorPosFromTouch(touch) {
  const rect   = canvas.getBoundingClientRect();
  const mouse  = new THREE.Vector2(
    ((touch.clientX - rect.left) / rect.width)  * 2 - 1,
   -((touch.clientY - rect.top)  / rect.height) * 2 + 1
  );
  const ray    = new THREE.Raycaster();
  ray.setFromCamera(mouse, activeCamera);
  const plane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  ray.ray.intersectPlane(plane, target);
  return target;
}

function measureToNearestWall(model) {
  if (!walls || walls.length === 0) return 'No walls found';
  const pos = model.position;
  const results = [];

  walls.forEach((wall, i) => {
    if (!wall.mesh) return;

    // Get wall direction and perpendicular
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) return;

    const nx = dx / len, nz = dz / len;   // along wall
    const px = -nz, pz = nx;              // perpendicular to wall

    // Vector from wall start to cabinet
    const tx = pos.x - wall.start.x;
    const tz = pos.z - wall.start.z;

    // How far along the wall is the cabinet?
    const along = tx * nx + tz * nz;
    if (along < 0 || along > len) return;  // cabinet not within wall's span

    // Perpendicular distance from wall centre line
    const perpDist = Math.abs(tx * px + tz * pz);
    const halfThick = (settings.wallThickness / 1000) / 2;
    const clearance = Math.max(0, perpDist - halfThick);

    results.push({
      index: i + 1,
      dist: Math.round(clearance * 1000)
    });
  });

  if (results.length === 0) return 'No walls alongside cabinet';

  // Sort nearest first
  results.sort((a, b) => a.dist - b.dist);

  return results
    .map(r => `Wall ${r.index}: ${r.dist}mm`)
    .join('\n');
}

// ─── Button actions ───────────────────────────────────────────────────────────

touchRotateBtn.addEventListener('click', () => {
  if (!touchSelectedModel) return;
  touchSelectedModel.rotation.y += Math.PI / 2;
});

touchDeselectBtn.addEventListener('click', () => {
  hideTouchOverlay();
  hideFloatPanel();
});

floatClose.addEventListener('click', () => {
  hideTouchOverlay();
  hideFloatPanel();
});

tfpDuplicate.addEventListener('click', () => {
  if (!touchSelectedModel) return;
  const clone = touchSelectedModel.clone();
  clone.position.set(
    touchSelectedModel.position.x + 0.2,
    touchSelectedModel.position.y,
    touchSelectedModel.position.z + 0.2
  );
  clone.userData = { ...touchSelectedModel.userData };
  scene.add(clone);
  placedItems.push(clone);
  if (typeof updateQuote === 'function') updateQuote();
});

tfpRuler.addEventListener('click', () => {
  if (!touchSelectedModel) return;
  rulerActive = !rulerActive;
  if (rulerActive) {
    tfpRuler.classList.add('tfp-btn-active');
    tfpRulerReadout.style.display = 'block';
    tfpRulerText.style.whiteSpace = 'pre-line';
    tfpRulerText.textContent = measureToNearestWall(touchSelectedModel);
  } else {
    tfpRuler.classList.remove('tfp-btn-active');
    tfpRulerReadout.style.display = 'none';
  }
});

tfpDelete.addEventListener('click', () => {
  if (!touchSelectedModel) return;
  scene.remove(touchSelectedModel);
  const idx = placedItems.indexOf(touchSelectedModel);
  if (idx > -1) placedItems.splice(idx, 1);
  if (typeof updateQuote === 'function') updateQuote();
  hideFloatPanel();
  hideTouchOverlay();
});

tfpHide.addEventListener('click', () => {
  if (!touchSelectedModel) return;
  touchSelectedModel.visible = !touchSelectedModel.visible;
  if (touchSelectedModel.visible) {
    tfpHide.textContent = '👁 Hide';
    tfpHide.classList.remove('tfp-btn-hidden');
  } else {
    tfpHide.textContent = '👁 Show';
    tfpHide.classList.add('tfp-btn-hidden');
  }
});

// ─── Drag handle ─────────────────────────────────────────────────────────────

touchDragBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!touchSelectedModel) return;
  touchDragActive = true;
  controls.enabled = false;
  isPanning2D = false;
  touchDragBtn.textContent = '✋ Dragging...';
  touchDragBtn.style.background = 'rgba(80,200,100,0.3)';
}, { passive: false });


canvas.addEventListener('touchmove', (e) => {
  if (!touchDragActive || !touchSelectedModel) return;
    // Handle wall handle drag on iPad
    if (canvas._draggingHandle) {
      e.preventDefault();
      const t = e.touches[0];
      const pt = getFloorPos({ clientX: t.clientX, clientY: t.clientY });
      if (!pt) return;
      const s = snapToGrid(pt);
      const handle = canvas._draggingHandle;
      const wallObj = handle.userData.wallObj;
      const idx = handle.userData.handleIndex;
      if (idx === 0) wallObj.start.copy(s);
      else wallObj.end.copy(s);
      handle.position.set(s.x, 0.08, s.z);
      scene.remove(wallObj.mesh);
      const dx = wallObj.end.x - wallObj.start.x;
      const dz = wallObj.end.z - wallObj.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < mm(50)) return;
      const h = mm(settings.ceilingHeight), t2 = mm(settings.wallThickness);
      wallObj.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(length, h, t2),
        new THREE.MeshStandardMaterial({ color: 0xff9500 })
      );
      wallObj.mesh.position.set(
        (wallObj.start.x + wallObj.end.x) / 2, h / 2,
        (wallObj.start.z + wallObj.end.z) / 2
      );
      wallObj.mesh.rotation.y = -Math.atan2(dz, dx);
      wallObj.mesh.castShadow = wallObj.mesh.receiveShadow = true;
      wallObj.mesh.userData.wallObj = wallObj;
      { const _op = (wallObj.opacity != null) ? wallObj.opacity : 1;
        wallObj.mesh.material.transparent = _op < 1;
        wallObj.mesh.material.opacity = _op; }
      scene.add(wallObj.mesh);
      return;
    }
  
  e.preventDefault();
  const touch = e.touches[0];
  const pt = getFloorPosFromTouch(touch);
  if (!pt) return;
  let s = snapToGrid(new THREE.Vector3(pt.x, 0, pt.z));
  const product = touchSelectedModel.userData?.product;
  if (product) s = snapToWall(s, mm(product.depth));
  touchSelectedModel.position.x = s.x;
  touchSelectedModel.position.z = s.z;
}, { passive: false });

canvas.addEventListener('touchend', () => {
  if (touchDragActive) {
    touchDragActive = false;
    controls.enabled = true;
    touchDragBtn.textContent = '✋ Hold & Drag';
    touchDragBtn.style.background = 'rgba(255,255,255,0.1)';
  }
});

// ─── Panel drag ──────────────────────────────────────────────────────────────

floatHandle.addEventListener('touchstart', (e) => {
  e.preventDefault();
  floatPanelDragging = true;
  const touch = e.touches[0];
  const rect  = floatPanel.getBoundingClientRect();
  floatDragOffsetX = touch.clientX - rect.left;
  floatDragOffsetY = touch.clientY - rect.top;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (!floatPanelDragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  floatPanel.style.left      = (touch.clientX - floatDragOffsetX) + 'px';
  floatPanel.style.top       = (touch.clientY - floatDragOffsetY) + 'px';
  floatPanel.style.transform = 'none';
}, { passive: false });

document.addEventListener('touchend', () => {
  floatPanelDragging = false;
});

// ─── Tap canvas to select model ───────────────────────────────────────────────

canvas.addEventListener('touchend', (e) => {
  console.log('[tap] touchend fired, mode=', mode, 'dragActive=', touchDragActive);
  if (typeof isTouchDevice === 'function' && !isTouchDevice()) return;
  console.log('[tap] passed isTouchDevice check');

  if (touchDragActive) return;
  if (mode !== 'select') return;


  const touch = e.changedTouches[0];
  const rect  = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((touch.clientX - rect.left) / rect.width)  * 2 - 1,
   -((touch.clientY - rect.top)  / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, activeCamera);

  const targets = [];
  placedItems.forEach(item => {
    // Skip door/window opening meshes — they belong to walls, not products
    if (item.userData?.type === 'door' || item.userData?.type === 'window') return;
    item.traverse(child => { if (child.isMesh) targets.push(child); });
  });

  const hits = raycaster.intersectObjects(targets, false);
    // Also check for wall taps on iPad
    const wallTapHits = raycaster.intersectObjects(walls.map(w => w.mesh));
    if (wallTapHits.length > 0 && hits.length === 0) {
      const tappedWall = wallTapHits[0].object.userData.wallObj;
      if (tappedWall) {
        showWallPopup(tappedWall, touch.clientX, touch.clientY);
        return;
      }
    }
  
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj.parent && !placedItems.includes(obj)) obj = obj.parent;
    showTouchOverlayAndPanel(obj);
  } else {
    hideTouchOverlay();
    hideFloatPanel();
  }
}, { passive: true });

      // ═══════════════════════════════════════════════════════
//  DRAW MODE EVENT HANDLERS (touch)
// ═══════════════════════════════════════════════════════

// ── Menu button handlers ─────────────────────────────────

document.getElementById('dmm-cancel').addEventListener('click', () => {
  hideDrawModeMenu();
});

document.getElementById('dmm-quick').addEventListener('click', () => {
  hideDrawModeMenu();
  drawModeActive = 'quick';
  mode = 'draw-wall';
  canvas.style.cursor = 'crosshair';
  hideWallPopup();
  controls.enabled = false;            // lock camera while drawing — no orbit/pan/zoom (touch + mouse)
  document.getElementById('btn-draw-wall').style.background = '#ff9500';
  document.getElementById('btn-draw-wall').style.color = '#fff';
});

document.getElementById('dmm-preset').addEventListener('click', () => {
  hideDrawModeMenu();
  drawModeActive = 'preset';
  mode = 'draw-preset';
  showPresetPicker();
});

document.getElementById('dmm-freehand').addEventListener('click', () => {
  hideDrawModeMenu();
  startGlideDraw();
});

document.getElementById('dmm-twopoint').addEventListener('click', () => {
  hideDrawModeMenu();
  drawModeActive = 'twopoint';
  mode = 'draw-twopoint';
  twoPtPhase = 0;
  twoPtStart = null;
  canvas.style.cursor = 'crosshair';
  controls.enabled = false;
  document.getElementById('btn-draw-wall').style.background = '#ff9500';
  document.getElementById('btn-draw-wall').style.color = '#fff';
  showConfirmBar('Tap your first corner');
});

// ── Free Draw (desktop mouse mode) ───────────────────────
// New, self-contained mode: free-angle drawing with 90° snap and a LOCKED camera
// (no orbit/pan while drawing). Quick Draw is intentionally left untouched.
// Wall selection / resize / slide editing is added in later steps.
let freeStart = null, freeFirst = null;
let fdEndpointGuides = [];

// Shared "align to the chain's starting corner" helper (used by Quick Draw + Free Draw).
// When the cursor lines up with the start corner's X or Z axis, snap onto it.
function snapToStartLine(s, startPt) {
  if (!startPt) return s;
  const th = mm(150);
  let x = s.x, z = s.z;
  if (Math.abs(s.x - startPt.x) < th) x = startPt.x;
  if (Math.abs(s.z - startPt.z) < th) z = startPt.z;
  return new THREE.Vector3(x, 0, z);
}
// Green guide line(s) through the start corner when the cursor is aligned with it.
function showStartAxisGuides(startPt, currentPt) {
  clearAxisGuides();
  if (!startPt || !currentPt) return;
  const th = mm(150), guideLen = 20;
  const mk = () => new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
  if (Math.abs(currentPt.z - startPt.z) < th) {
    axisGuideZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-guideLen, 0.035, startPt.z),
      new THREE.Vector3( guideLen, 0.035, startPt.z),
    ]), mk());
    scene.add(axisGuideZ);
  }
  if (Math.abs(currentPt.x - startPt.x) < th) {
    axisGuideX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startPt.x, 0.035, -guideLen),
      new THREE.Vector3(startPt.x, 0.035,  guideLen),
    ]), mk());
    scene.add(axisGuideX);
  }
}

// Free Draw variant: green for vertical (X-axis), blue for horizontal (Z-axis)
function fdShowStartAxisGuides(startPt, currentPt) {
  clearAxisGuides();
  if (!startPt || !currentPt) return;
  const th = mm(150), guideLen = 20;
  const mkHoriz = () => new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.7 });
  const mkVert  = () => new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
  if (Math.abs(currentPt.z - startPt.z) < th) {
    axisGuideZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-guideLen, 0.035, startPt.z),
      new THREE.Vector3( guideLen, 0.035, startPt.z),
    ]), mkHoriz());
    scene.add(axisGuideZ);
  }
  if (Math.abs(currentPt.x - startPt.x) < th) {
    axisGuideX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startPt.x, 0.035, -guideLen),
      new THREE.Vector3(startPt.x, 0.035,  guideLen),
    ]), mkVert());
    scene.add(axisGuideX);
  }
}

// ── Free Draw endpoint guides ──────────────────────────────────────────────────
// Shown when no chain is active: green lines through wall-endpoint axes so the
// user can visually continue a square room after re-entering draw mode.
function clearFdEndpointGuides() {
  fdEndpointGuides.forEach(g => scene.remove(g));
  fdEndpointGuides = [];
}

function fdShowEndpointGuides(curPt) {
  clearFdEndpointGuides();
  if (!curPt || walls.length === 0) return;
  const th = mm(150), guideLen = 20;
  const mat = () => new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.55 });
  // Keep at most one guide per axis (nearest matching endpoint) to avoid clutter.
  let bestX = null, bestXDist = Infinity;
  let bestZ = null, bestZDist = Infinity;
  walls.forEach(w => {
    [w.start, w.end].forEach(ep => {
      const dx = Math.abs(curPt.x - ep.x);
      const dz = Math.abs(curPt.z - ep.z);
      if (dx < th && dx < bestXDist) { bestXDist = dx; bestX = ep; }
      if (dz < th && dz < bestZDist) { bestZDist = dz; bestZ = ep; }
    });
  });
  if (bestZ) {
    const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-guideLen, 0.03, bestZ.z),
      new THREE.Vector3( guideLen, 0.03, bestZ.z),
    ]), mat());
    scene.add(g); fdEndpointGuides.push(g);
  }
  if (bestX) {
    const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bestX.x, 0.03, -guideLen),
      new THREE.Vector3(bestX.x, 0.03,  guideLen),
    ]), mat());
    scene.add(g); fdEndpointGuides.push(g);
  }
}

// Snap s onto any visible endpoint guide axis (same threshold as fdShowEndpointGuides).
// Returns a new Vector3 with x and/or z locked to the nearest matching wall endpoint.
function fdEndpointSnap(s) {
  if (!s || walls.length === 0) return s;
  const th = mm(150);
  let x = s.x, z = s.z;
  let bestXDist = Infinity, bestZDist = Infinity;
  walls.forEach(w => {
    [w.start, w.end].forEach(ep => {
      const dx = Math.abs(s.x - ep.x);
      const dz = Math.abs(s.z - ep.z);
      if (dx < th && dx < bestXDist) { bestXDist = dx; x = ep.x; }
      if (dz < th && dz < bestZDist) { bestZDist = dz; z = ep.z; }
    });
  });
  return new THREE.Vector3(x, s.y, z);
}

// Returns true when the preview line from→to is within 5° of any existing wall.
function fdIsParallelToAnyWall(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return false;
  for (const w of walls) {
    const wdx = w.end.x - w.start.x, wdz = w.end.z - w.start.z;
    const wlen = Math.hypot(wdx, wdz);
    if (wlen < 1e-4) continue;
    const dot = (dx / len) * (wdx / wlen) + (dz / len) * (wdz / wlen);
    if (Math.acos(Math.max(-1, Math.min(1, Math.abs(dot)))) * 180 / Math.PI < 5) return true;
  }
  return false;
}

function startFreeDraw() {
  if (['draw-preset','draw-freehand','draw-twopoint'].includes(mode)) abortPreviewWalls();
  hideWallPopup();
  drawModeActive = 'free';
  mode = 'draw-free';
  freeStart = freeFirst = null;
  fdDeselect();                             // start with a clean selection
  canvas.style.cursor = 'crosshair';
  controls.enabled = false;                 // camera lock — no orbit/pan
  const b = document.getElementById('btn-free-draw');
  if (b) { b.style.background = '#ff9500'; b.style.color = '#fff'; }
  const rbar = document.getElementById('fd-ruler-bar');
  if (rbar) rbar.style.display = 'block';
}

function cancelFreeDraw() {
  hideWallDimInput();
  fdDeselect();                             // clear any selected-wall edit state
  freeStart = freeFirst = null;
  mode = 'select';
  drawModeActive = null;
  canvas.style.cursor = 'default';
  if (previewLine) { scene.remove(previewLine); previewLine = null; }
  clearAxisGuides();
  clearFdEndpointGuides();
  closeHint.style.display = 'none';
  dimLabel.style.display  = 'none';
  if (is3D) controls.enabled = true;        // restore camera on exit
  const b = document.getElementById('btn-free-draw');
  if (b) { b.style.background = ''; b.style.color = ''; }
  fdRulerClearAll();
  fdHideSplitLabels();
  const rbar = document.getElementById('fd-ruler-bar');
  if (rbar) rbar.style.display = 'none';
}

// Snap helper shared by Free Draw preview + click: free angle, 90° on Shift / within 5°
function freeDrawSnap(s) {
  let snapMode = 'free';
  const rdx = s.x - freeStart.x, rdz = s.z - freeStart.z;
  const len = Math.hypot(rdx, rdz);
  if (len > 1e-4) {
    const ang    = Math.atan2(Math.abs(rdz), Math.abs(rdx)) * 180 / Math.PI;
    const toAxis = Math.min(ang, 90 - ang);
    if (shiftDown || toAxis <= 5) {
      s = Math.abs(rdx) >= Math.abs(rdz)
        ? new THREE.Vector3(s.x, 0, freeStart.z)
        : new THREE.Vector3(freeStart.x, 0, s.z);
      snapMode = '90deg';
    }
  }
  return { point: s, snapMode };
}

document.getElementById('btn-free-draw')?.addEventListener('click', () => {
  if (mode === 'draw-free') cancelFreeDraw();
  else startFreeDraw();
});

// Free Draw — live preview
canvas.addEventListener('mousemove', (e) => {
  if (mode !== 'draw-free') return;
  if (fdRulerActive) { fdRulerMouseMove(e); return; }
  const pt = getFloorPos(e); if (!pt) return;
  let s = snapToCorner(snapToGrid(pt));

  // No chain started yet: show green endpoint-alignment guides + split-distance labels.
  if (!freeStart) {
    fdUpdateSplitLabels(e, s);
    fdShowEndpointGuides(s);
    return;
  }
  const { point, snapMode } = freeDrawSnap(s);
  s = point;

  // Align to the chain's starting corner, then lock onto any visible endpoint guide.
  s = snapToStartLine(s, freeFirst);
  s = fdEndpointSnap(s);
  fdShowStartAxisGuides(freeFirst, s);
  fdShowEndpointGuides(s);

  if (freeFirst && s.distanceTo(freeFirst) < 0.2) {
    s = freeFirst.clone();
    closeHint.style.left = (e.clientX + 15) + 'px';
    closeHint.style.top  = (e.clientY + 10) + 'px';
    closeHint.style.display = 'block';
  } else {
    closeHint.style.display = 'none';
  }

  // Preview colour: blue = parallel to an existing wall, green = 90°-snapped, orange = free
  const parallelToWall = fdIsParallelToAnyWall(freeStart, s);
  const previewColor   = parallelToWall ? 0x4488ff : (snapMode === '90deg' ? 0x00ff88 : 0xff9500);
  const labelColor     = parallelToWall ? '#4488ff' : (snapMode === '90deg' ? '#00aa55' : '#ff9500');

  if (previewLine) scene.remove(previewLine);
  previewLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(freeStart.x, 0.02, freeStart.z),
      new THREE.Vector3(s.x, 0.02, s.z),
    ]),
    new THREE.LineBasicMaterial({ color: previewColor })
  );
  scene.add(previewLine);

  dimLabel.textContent   = Math.round(freeStart.distanceTo(s) * 1000) + ' mm';
  dimLabel.style.left    = (e.clientX + 15) + 'px';
  dimLabel.style.top     = (e.clientY - 10) + 'px';
  dimLabel.style.color   = labelColor;
  dimLabel.style.display = 'block';
});

// Free Draw — place corners on click (or select an existing wall to edit)
canvas.addEventListener('click', (e) => {
  if (mode !== 'draw-free') return;
  if (fdRulerActive) { fdRulerClick(e); return; }
  if (fdSuppressClick) { fdSuppressClick = false; return; }  // swallow the click that ended a slide-drag / anchor pick

  // When NOT mid-chain:
  //   Left-click on a wall → start a new wall's first point, projected onto the wall
  //                          centreline (grid-snapped). Editing lives in Select mode now.
  if (!freeStart) {
    const hitWall = fdRaycastWall(e);
    if (hitWall) {
      const pt0 = getFloorPos(e);
      if (pt0) {
        fdHideSplitLabels();
        const proj = fdProjectOntoWall(hitWall, snapToGrid(pt0));
        freeStart = proj.clone();
        freeFirst = proj.clone();
      }
      return;
    }
    if (fdSel) { fdDeselect(); return; }   // safety: clear any stale selection
  }

  const pt = getFloorPos(e); if (!pt) return;
  let s = snapToCorner(snapToGrid(pt));
  if (freeStart) { s = freeDrawSnap(s).point; s = snapToStartLine(s, freeFirst); }
  s = fdEndpointSnap(s);   // lock onto any visible green endpoint guide

  if (!freeStart) {
    fdHideSplitLabels();
    freeStart = s.clone(); freeFirst = s.clone();
  } else if (freeFirst && s.distanceTo(freeFirst) < 0.2) {
    buildWall(freeStart, freeFirst);
    lockRoom();
    cancelFreeDraw();
  } else {
    buildWall(freeStart, s);
    freeStart = s.clone();
  }
});

// Free Draw — Escape exits ruler first, then draw mode cleanly
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mode === 'draw-free') {
    if (fdRulerActive) fdRulerDeactivate();
    else cancelFreeDraw();
  }
});

// ── Free Draw: select + edit an existing wall (FD-2 / FD-3 / FD-4) ────────────
// Only active while mode === 'draw-free'. Editing one wall NEVER moves the others.
let fdSel          = null;       // wallObj currently selected for editing
let fdAnchor       = 'start';    // which END stays locked: 'start' | 'end'
let fdSuppressClick = false;     // swallow the click that ends a slide-drag / anchor pick
let fdDragging     = false;
let fdOrigStart    = null, fdOrigEnd = null, fdDragRef = null, fdLastNs = null, fdLastNe = null;

// ── Free Draw Ruler state (Task 2) ─────────────────────────────────────────
let fdRulerActive        = false;
let fdRulerHoveredWall   = null;       // wall highlighted orange while hovering
let fdRulerFloatingLabel = null;       // DOM label following mouse after first wall click
let fdRulerPinnedLabels  = [];         // [{ wallObj, side, lengthMm, el }]
let fdRulerSide          = 'exterior'; // 'exterior' | 'interior' | 'centre'
let fdRulerFirstWall     = null;       // wall from first ruler click

// ── Free Draw split-distance hover state ───────────────────────────────────
let fdSplitLabelA    = null;   // DOM label at wall.start end
let fdSplitLabelB    = null;   // DOM label at wall.end end
let fdSplitHoveredWall = null; // wall currently being split-labelled

function fdRaycastWall(e) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const hits = raycaster.intersectObjects(walls.map(w => w.mesh))
    .filter(h => walls.includes(h.object.userData.wallObj));
  return hits.length ? hits[0].object.userData.wallObj : null;
}

// Colour the two end handles: green = locked anchor, white = the end that moves.
function fdHandleColors() {
  wallHandleGroup.children.forEach(h => {
    const isAnchor = (h.userData.handleIndex === 0 && fdAnchor === 'start') ||
                     (h.userData.handleIndex === 1 && fdAnchor === 'end');
    h.material.color.set(isAnchor ? 0x00ff88 : 0xffffff);
  });
}

function fdSelectWall(w) {
  fdDeselect();
  fdSel = w;
  fdAnchor = 'start';
  walls.forEach(x => x.mesh.material.color.set(wallBaseColor(x)));
  w.mesh.material.color.set(0xff9500);
  showWallHandles(w);
  fdHandleColors();
  fdShowEditor(w);
}

function fdDeselect() {
  fdSel = null;
  fdDragging = false;
  fdLastNs = fdLastNe = null;
  clearWallHandles();
  walls.forEach(x => x.mesh.material.color.set(wallBaseColor(x)));
  if (fdEditEl) fdEditEl.style.display = 'none';
  if (wallPopup.style.display === 'block') hideWallPopup();
}

// Replace one wall's geometry (anchor preserved by caller) and record undoable history.
function fdReplaceWall(oldWall, ns, ne) {
  scene.remove(oldWall.mesh);
  if (oldWall.capMeshes) oldWall.capMeshes.forEach(c => scene.remove(c));
  if (oldWall.label2D)   wall2DLabelGroup.remove(oldWall.label2D);
  walls = walls.filter(w => w !== oldWall);
  const nw = buildWall(ns, ne, true);
  if (!nw) {                                  // too short — keep the original
    scene.add(oldWall.mesh); walls.push(oldWall);
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); updateRoomArea();
    return oldWall;
  }
  carryWallStyle(oldWall, nw);                // preserve colour + opacity across resize
  nw.mesh.material.color.set(0xff9500);       // selected highlight (opacity kept)
  pushHistory({ type: 'resize-wall', data: { removed: [oldWall], restored: [nw] } });
  rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); updateRoomArea();
  return nw;
}

// ── Floating length editor (FD-3) ─────────────────────────────────────────────
const fdEditEl = document.createElement('div');
fdEditEl.style.cssText = 'display:none;position:fixed;z-index:200;background:#2a2a2a;border:1px solid #ff9500;border-radius:8px;padding:8px 10px;align-items:center;gap:6px;font-family:Arial;font-size:12px;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.5);';
fdEditEl.innerHTML = [
  '<input id="fd-len" type="number" step="10" min="100" style="width:78px;background:#333;border:1px solid #ff9500;border-radius:6px;color:#fff;padding:6px 8px;font-size:14px;box-sizing:border-box"/>',
  '<span style="color:#aaa">mm</span>',
  '<button id="fd-ok" style="background:#ff9500;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:bold">OK</button>',
  '<button id="fd-flip" title="Switch which end stays locked" style="background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:6px 8px;cursor:pointer;font-size:12px">⇄ anchor</button>',
].join('');
document.body.appendChild(fdEditEl);
['click','mousedown','touchstart','pointerdown'].forEach(ev =>
  fdEditEl.addEventListener(ev, (e) => e.stopPropagation()));

function fdShowEditor(w) {
  // Open the main Edit Wall popup rather than the small fdEditEl.
  const mid = new THREE.Vector3((w.start.x + w.end.x) / 2, 0, (w.start.z + w.end.z) / 2).project(activeCamera);
  const sx = (mid.x *  0.5 + 0.5) * window.innerWidth;
  const sy = (mid.y * -0.5 + 0.5) * window.innerHeight;
  selectedWall = w;   // keep in sync so wallPopup's OK/delete handlers target the right wall
  showWallPopup(w, sx, sy);
}

function fdApplyLength() {
  if (!fdSel) return;
  const v = parseFloat(document.getElementById('fd-len').value);
  if (!(v > 0)) return;
  const anchor = (fdAnchor === 'start' ? fdSel.start : fdSel.end).clone();
  const moving = (fdAnchor === 'start' ? fdSel.end   : fdSel.start).clone();
  const dir    = new THREE.Vector3().subVectors(moving, anchor).normalize();
  const newMov = anchor.clone().addScaledVector(dir, mm(v));   // angle preserved
  const ns = fdAnchor === 'start' ? anchor : newMov;
  const ne = fdAnchor === 'start' ? newMov : anchor;
  fdSel = fdReplaceWall(fdSel, ns, ne);
  showWallHandles(fdSel); fdHandleColors(); fdShowEditor(fdSel);
}

document.getElementById('fd-ok').addEventListener('click', fdApplyLength);
document.getElementById('fd-len').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); fdApplyLength(); }
});
document.getElementById('fd-flip').addEventListener('click', () => {
  if (!fdSel) return;
  fdAnchor = fdAnchor === 'start' ? 'end' : 'start';
  fdHandleColors();
});

// ── Slide a selected wall (FD-4): drag the body, angle locked, grid-snapped ────
canvas.addEventListener('mousedown', (e) => {
  if (mode !== 'draw-free' || freeStart || !fdSel) return;
  if (fdRulerActive) return;
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);

  // Clicking an end handle sets that end as the locked anchor.
  const hHits = raycaster.intersectObjects(wallHandleGroup.children);
  if (hHits.length) {
    fdAnchor = hHits[0].object.userData.handleIndex === 0 ? 'start' : 'end';
    fdHandleColors();
    const anchorBtn = document.getElementById('wp-fd-anchor');
    if (anchorBtn) anchorBtn.textContent = '⇄ Anchor: ' + fdAnchor;
    fdSuppressClick = true;
    return;
  }

  // Clicking the wall body starts a parallel slide.
  if (raycaster.intersectObject(fdSel.mesh).length) {
    const fp = getFloorPos(e); if (!fp) return;
    fdDragging  = true;
    fdDragRef   = fp.clone();
    fdOrigStart = fdSel.start.clone();
    fdOrigEnd   = fdSel.end.clone();
    fdLastNs = fdLastNe = null;
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (mode !== 'draw-free' || !fdDragging || !fdSel) return;
  const fp = getFloorPos(e); if (!fp) return;
  const dir  = new THREE.Vector3().subVectors(fdOrigEnd, fdOrigStart).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);          // slide perpendicular → parallel move
  const grid = mm(settings.gridSize) || mm(50);
  let amt = new THREE.Vector3().subVectors(fp, fdDragRef).dot(perp);
  amt = Math.round(amt / grid) * grid;                       // grid snap
  const off = perp.clone().multiplyScalar(amt);
  fdLastNs = fdOrigStart.clone().add(off);
  fdLastNe = fdOrigEnd.clone().add(off);

  const h = fdSel.mesh.geometry.parameters.height;           // live mesh reposition (rotation unchanged)
  fdSel.mesh.position.set((fdLastNs.x + fdLastNe.x) / 2, SLAB_H + h / 2, (fdLastNs.z + fdLastNe.z) / 2);
  wallHandleGroup.children.forEach(hd => {
    const pt = hd.userData.handleIndex === 0 ? fdLastNs : fdLastNe;
    hd.position.set(pt.x, 0.08, pt.z);
  });
});

window.addEventListener('mouseup', () => {
  if (mode !== 'draw-free' || !fdDragging) return;
  fdDragging = false;
  fdSuppressClick = true;                                    // don't let this mouseup's click deselect
  if (fdLastNs && fdLastNe && fdLastNs.distanceTo(fdSel.start) > 1e-4) {
    fdSel = fdReplaceWall(fdSel, fdLastNs.clone(), fdLastNe.clone());
    showWallHandles(fdSel); fdHandleColors(); fdShowEditor(fdSel);
  }
  fdLastNs = fdLastNe = null;
});

// ── Free Draw: wall-body projection helpers ────────────────────────────────

// Project a floor point onto the wall's longitudinal centreline, clamped to the wall's extent.
function fdProjectOntoWall(w, p) {
  const dir = new THREE.Vector3().subVectors(w.end, w.start);
  const len = dir.length();
  dir.normalize();
  const t = new THREE.Vector3().subVectors(p, w.start).dot(dir);
  return w.start.clone().addScaledVector(dir, Math.max(0, Math.min(len, t)));
}

// Project a world Vector3 to a { x, y } CSS pixel position.
function fdWorldToScreen(v) {
  const p = v.clone().project(activeCamera);
  return {
    x: Math.round(( p.x *  0.5 + 0.5) * window.innerWidth),
    y: Math.round((-p.y *  0.5 + 0.5) * window.innerHeight),
  };
}

// Show / update the two split-distance labels on a hovered wall.
function fdUpdateSplitLabels(e, floorPt) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const hits = raycaster.intersectObjects(walls.map(w => w.mesh))
    .filter(h => walls.includes(h.object.userData.wallObj));
  const hitWall = hits.length ? hits[0].object.userData.wallObj : null;

  if (!hitWall) {
    fdHideSplitLabels();
    fdSplitHoveredWall = null;
    return;
  }
  fdSplitHoveredWall = hitWall;

  const proj = fdProjectOntoWall(hitWall, floorPt);
  const dA   = Math.round(proj.distanceTo(hitWall.start) * 1000);
  const dB   = Math.round(proj.distanceTo(hitWall.end)   * 1000);

  if (!fdSplitLabelA) {
    fdSplitLabelA = document.createElement('div');
    fdSplitLabelA.className = 'fd-split-label';
    document.body.appendChild(fdSplitLabelA);
  }
  fdSplitLabelA.textContent  = '\u2190' + dA + '\u202fmm\u2002|\u2002' + dB + '\u202fmm\u2192';
  fdSplitLabelA.style.left   = (e.clientX + 14) + 'px';
  fdSplitLabelA.style.top    = (e.clientY - 28) + 'px';
  fdSplitLabelA.style.display = 'block';
}

function fdHideSplitLabels() {
  if (fdSplitLabelA) fdSplitLabelA.style.display = 'none';
  if (fdSplitLabelB) fdSplitLabelB.style.display = 'none';
  fdSplitHoveredWall = null;
}

// ── Free Draw Ruler tool (Task 2) ─────────────────────────────────────────

// Detect which face of the wall was clicked relative to its perpendicular axis.
function fdRulerDetectSide(w, hitPoint) {
  const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return 'centre';
  const nx = dx / len, nz = dz / len;
  const perpX = -nz, perpZ = nx;
  const midX = (w.start.x + w.end.x) / 2;
  const midZ = (w.start.z + w.end.z) / 2;
  const dot  = (hitPoint.x - midX) * perpX + (hitPoint.z - midZ) * perpZ;
  const halfT = mm(settings.wallThickness) / 2;
  if (dot >  halfT * 0.3) return 'exterior';
  if (dot < -halfT * 0.3) return 'interior';
  return 'centre';
}

function fdRulerSideLabel(side) {
  if (side === 'exterior') return 'Ext';
  if (side === 'interior') return 'Int';
  return 'CL';
}

// Mousemove handler while ruler is active: hover highlight + follow floating label.
function fdRulerMouseMove(e) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const hits = raycaster.intersectObjects(walls.map(w => w.mesh))
    .filter(h => walls.includes(h.object.userData.wallObj));
  const hitWall = hits.length ? hits[0].object.userData.wallObj : null;

  // Orange hover highlight — restore previous hovered wall's colour first.
  if (hitWall !== fdRulerHoveredWall) {
    if (fdRulerHoveredWall) {
      const wasSelected = (fdRulerHoveredWall === fdSel);
      fdRulerHoveredWall.mesh.material.color.set(wasSelected ? 0xff9500 : wallBaseColor(fdRulerHoveredWall));
    }
    fdRulerHoveredWall = hitWall;
    if (hitWall) hitWall.mesh.material.color.set(0xff9500);
  }

  // Move floating label with cursor after first wall click.
  if (fdRulerFirstWall && fdRulerFloatingLabel) {
    fdRulerFloatingLabel.style.left = (e.clientX + 14) + 'px';
    fdRulerFloatingLabel.style.top  = (e.clientY - 10) + 'px';
  }
}

// Click handler while ruler is active.
function fdRulerClick(e) {
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const hits = raycaster.intersectObjects(walls.map(w => w.mesh))
    .filter(h => walls.includes(h.object.userData.wallObj));
  const hitWall = hits.length ? hits[0].object.userData.wallObj : null;

  if (!fdRulerFirstWall) {
    // First click must land on a wall face.
    if (!hitWall) return;
    fdRulerFirstWall = hitWall;
    fdRulerSide = fdRulerDetectSide(hitWall, hits[0].point);
    const lengthMm = Math.round(hitWall.start.distanceTo(hitWall.end) * 1000);
    if (fdRulerFloatingLabel) fdRulerFloatingLabel.remove();
    fdRulerFloatingLabel = document.createElement('div');
    fdRulerFloatingLabel.className = 'fd-ruler-label';
    fdRulerFloatingLabel.textContent = fdRulerSideLabel(fdRulerSide) + ': ' + lengthMm + ' mm';
    fdRulerFloatingLabel.style.left = (e.clientX + 14) + 'px';
    fdRulerFloatingLabel.style.top  = (e.clientY - 10) + 'px';
    document.body.appendChild(fdRulerFloatingLabel);
  } else {
    // Second click pins the floating label at the current cursor position.
    fdRulerPinAt(e.clientX, e.clientY);
    fdRulerFirstWall = null;
  }
}

// Pin the floating label, appending a dismissible DOM element.
function fdRulerPinAt(sx, sy) {
  if (!fdRulerFirstWall) return;
  const w        = fdRulerFirstWall;
  const side     = fdRulerSide;
  const lengthMm = Math.round(w.start.distanceTo(w.end) * 1000);
  if (fdRulerFloatingLabel) { fdRulerFloatingLabel.remove(); fdRulerFloatingLabel = null; }

  const el = document.createElement('div');
  el.className = 'fd-ruler-label pinned';
  el.innerHTML =
    '<span>' + fdRulerSideLabel(side) + ': <strong>' + lengthMm + '\u202fmm</strong></span>' +
    '<button class="fd-ruler-dismiss" title="Dismiss">✕</button>';
  el.style.left = sx + 'px';
  el.style.top  = sy + 'px';
  document.body.appendChild(el);

  const entry = { wallObj: w, side, lengthMm, el };
  fdRulerPinnedLabels.push(entry);
  el.querySelector('.fd-ruler-dismiss').addEventListener('click', (ev) => {
    ev.stopPropagation();
    entry.el.remove();
    fdRulerPinnedLabels = fdRulerPinnedLabels.filter(x => x !== entry);
  });
}

// Deactivate ruler mode without clearing pinned labels.
function fdRulerDeactivate() {
  fdRulerActive = false;
  // Restore hovered wall to its previous colour.
  if (fdRulerHoveredWall) {
    const wasSelected = (fdRulerHoveredWall === fdSel);
    fdRulerHoveredWall.mesh.material.color.set(wasSelected ? 0xff9500 : wallBaseColor(fdRulerHoveredWall));
    fdRulerHoveredWall = null;
  }
  // Remove any in-flight floating label.
  if (fdRulerFloatingLabel) { fdRulerFloatingLabel.remove(); fdRulerFloatingLabel = null; }
  fdRulerFirstWall = null;
  canvas.style.cursor = 'crosshair';  // stay in draw-free cursor
  const btn = document.getElementById('btn-fd-ruler');
  if (btn) btn.classList.remove('active');
}

// Full reset: deactivate + remove all pinned labels. Called on Free Draw exit.
function fdRulerClearAll() {
  fdRulerDeactivate();
  fdRulerPinnedLabels.forEach(entry => entry.el.remove());
  fdRulerPinnedLabels = [];
}

document.getElementById('btn-fd-ruler')?.addEventListener('click', () => {
  if (!fdRulerActive) {
    fdRulerActive = true;
    freeStart = null;                                        // suspend chain drawing
    if (previewLine) { scene.remove(previewLine); previewLine = null; }
    dimLabel.style.display  = 'none';
    closeHint.style.display = 'none';
    canvas.style.cursor = 'crosshair';
    const btn = document.getElementById('btn-fd-ruler');
    if (btn) btn.classList.add('active');
  } else {
    fdRulerDeactivate();
  }
});

// ── Preset picker handlers ───────────────────────────────

document.getElementById('dpp-back').addEventListener('click', () => {
  hidePresetPicker();
  drawModeActive = null;
  mode = 'select';
});

document.getElementById('dpp-rect').addEventListener('click', () => {
  hidePresetPicker();
  const s = 3.0;
  previewWallPoints = [
    new THREE.Vector3(-s/2, 0, -s/2),
    new THREE.Vector3( s/2, 0, -s/2),
    new THREE.Vector3( s/2, 0,  s/2),
    new THREE.Vector3(-s/2, 0,  s/2),
  ];
  drawPreviewPolygon(previewWallPoints);
  showConfirmBar('Drag corners to resize · ✓ to confirm');
  drawModeActive = 'preset';
  mode = 'draw-preset';
  canvas.style.cursor = 'default';
});

document.getElementById('dpp-lshape').addEventListener('click', () => {
  hidePresetPicker();
  previewWallPoints = [
    new THREE.Vector3(-2,   0, -1.5),
    new THREE.Vector3( 2,   0, -1.5),
    new THREE.Vector3( 2,   0,  0.5),
    new THREE.Vector3( 0.5, 0,  0.5),
    new THREE.Vector3( 0.5, 0,  1.5),
    new THREE.Vector3(-2,   0,  1.5),
  ];
  drawPreviewPolygon(previewWallPoints);
  showConfirmBar('Drag corners to resize · ✓ to confirm');
  drawModeActive = 'preset';
  mode = 'draw-preset';
  canvas.style.cursor = 'default';
});

// ── Confirm / cancel bar handlers ───────────────────────

document.getElementById('draw-confirm-tick').addEventListener('click', () => {
  if (drawModeActive === 'freehand' && freehandRawPoints.length >= 3) {
    previewWallPoints = orthogonalisePoints(freehandRawPoints);
    freehandRawPoints = [];
    drawModeActive = 'preset';   // ← set BEFORE redraw
    mode = 'draw-preset';
    clearPreview();
    drawPreviewPolygon(previewWallPoints);
    showConfirmBar('Drag corners to adjust · ✓ to confirm walls');
    return;
  }
  confirmPreviewWalls();
});


document.getElementById('draw-confirm-cancel').addEventListener('click', () => {
  abortPreviewWalls();
});

// ── Escape key support ───────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (mode === 'draw-freehand' && freehandRawPoints.length >= 3) {
    previewWallPoints = orthogonalisePoints(freehandRawPoints);
    freehandRawPoints = [];
    clearPreview();
    drawPreviewPolygon(previewWallPoints);
    showConfirmBar('Drag corners to adjust · ✓ to confirm walls');
    drawModeActive = 'preset';
    mode = 'draw-preset';
  } else if (['draw-freehand','draw-twopoint','draw-preset'].includes(mode)) {
    abortPreviewWalls();
  }
});

// ── Canvas click — freehand and twopoint ────────────────
function handleDrawClick(clientX, clientY) {
  if (isPanning2D) return;

  // Freehand: each tap adds a corner
  if (mode === 'draw-freehand') {
    const pt = getFloorPos({ clientX, clientY });
    if (!pt) return;
    const s = snapToGrid(pt);
    freehandRawPoints.push(s.clone());

    clearPreview();
    if (freehandRawPoints.length >= 2) {
      for (let i = 0; i < freehandRawPoints.length - 1; i++) {
        const a = freehandRawPoints[i], b = freehandRawPoints[i + 1];
        previewMeshGroup.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(a.x, 0.03, a.z),
            new THREE.Vector3(b.x, 0.03, b.z)
          ]),
          new THREE.LineBasicMaterial({ color: 0xffdd44, opacity: 0.8, transparent: true })
        ));
      }
    }
    freehandRawPoints.forEach(p => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      dot.position.set(p.x, 0.05, p.z);
      previewMeshGroup.add(dot);
    });
    return;
  }

  // Two-point: first or second tap
  if (mode === 'draw-twopoint') {
    const pt = getFloorPos({ clientX, clientY });
    if (!pt) return;
    const s = snapToGrid(pt);

    if (twoPtPhase === 0) {
      twoPtStart = s.clone();
      twoPtPhase = 1;
      showConfirmBar('Now tap the opposite corner');
      clearPreview();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff9500 })
      );
      dot.position.set(s.x, 0.06, s.z);
      previewMeshGroup.add(dot);
    } else {
      const a = twoPtStart, b = s;
      previewWallPoints = [
        new THREE.Vector3(a.x, 0, a.z),
        new THREE.Vector3(b.x, 0, a.z),
        new THREE.Vector3(b.x, 0, b.z),
        new THREE.Vector3(a.x, 0, b.z),
      ];
      drawPreviewPolygon(previewWallPoints);
      showConfirmBar('Drag corners to adjust · ✓ to confirm');
      twoPtPhase = 0;
      drawModeActive = 'preset';
      mode = 'draw-preset';
    }
    return;
  }
}

canvas.addEventListener('click', (e) => {
  if (isPanning2D) return;
  if (mode === 'draw-freehand' || mode === 'draw-twopoint') {
    handleDrawClick(e.clientX, e.clientY);
    return;
  }
});


// ── Preview handle drag — mouse ──────────────────────────

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || mode !== 'draw-preset') return;
  updateMouse(e);
  raycaster.setFromCamera(mouse, activeCamera);
  const handles = previewMeshGroup.children.filter(
    c => c.userData.previewHandleIndex !== undefined
  );
  const hits = raycaster.intersectObjects(handles);
  if (hits.length > 0) {
    draggingPreviewHdl = hits[0].object.userData.previewHandleIndex;
    const fp = getFloorPos(e);
    if (fp) prevHdlOffset.set(
      previewWallPoints[draggingPreviewHdl].x - fp.x, 0,
      previewWallPoints[draggingPreviewHdl].z - fp.z
    );
    controls.enabled = false;
    e.stopImmediatePropagation();
  }
}, { capture: true });

canvas.addEventListener('mousemove', (e) => {
  if (draggingPreviewHdl === null || mode !== 'draw-preset') return;
  const pt = getFloorPos(e); if (!pt) return;
  const s = snapToGrid(new THREE.Vector3(
    pt.x + prevHdlOffset.x, 0,
    pt.z + prevHdlOffset.z
  ));
  previewWallPoints[draggingPreviewHdl].set(s.x, 0, s.z);
  drawPreviewPolygon(previewWallPoints);
}, { capture: true });

canvas.addEventListener('mouseup', () => {
  if (draggingPreviewHdl !== null) {
    draggingPreviewHdl = null;
    controls.enabled = true;
  }
}, { capture: true });

// ── Preview handle drag — touch ──────────────────────────

canvas.addEventListener('touchstart', (e) => {
  if (mode !== 'draw-preset' || e.touches.length !== 1) return;
  const t = e.touches[0];
  updateMouse({ clientX: t.clientX, clientY: t.clientY });
  raycaster.setFromCamera(mouse, activeCamera);
  const handles = previewMeshGroup.children.filter(
    c => c.userData.previewHandleIndex !== undefined
  );
  const hits = raycaster.intersectObjects(handles);
  if (hits.length > 0) {
    draggingPreviewHdl = hits[0].object.userData.previewHandleIndex;
    const fp = getFloorPos({ clientX: t.clientX, clientY: t.clientY });
    if (fp) prevHdlOffset.set(
      previewWallPoints[draggingPreviewHdl].x - fp.x, 0,
      previewWallPoints[draggingPreviewHdl].z - fp.z
    );
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (draggingPreviewHdl === null || mode !== 'draw-preset') return;
  e.preventDefault();
  const t  = e.touches[0];
  const pt = getFloorPos({ clientX: t.clientX, clientY: t.clientY });
  if (!pt) return;
  const s = snapToGrid(new THREE.Vector3(
    pt.x + prevHdlOffset.x, 0,
    pt.z + prevHdlOffset.z
  ));
  previewWallPoints[draggingPreviewHdl].set(s.x, 0, s.z);
  drawPreviewPolygon(previewWallPoints);
}, { passive: false });

canvas.addEventListener('touchend', () => {
  if (draggingPreviewHdl !== null) {
    draggingPreviewHdl = null;
    controls.enabled = true;
  }
});

// ── Product panel toggle ──────────────────────────────────────────────────────
const productPanel      = document.getElementById('product-panel');
const drawerBackdrop    = document.getElementById('drawer-backdrop');
const btnProductsToggle = document.getElementById('btn-products-toggle');

function openProductPanel() {
  productPanel.classList.add('open');
  drawerBackdrop.classList.add('visible');
}
function closeProductPanel() {
  productPanel.classList.remove('open');
  drawerBackdrop.classList.remove('visible');
}

btnProductsToggle.addEventListener('click', () => {
  if (productPanel.classList.contains('open')) {
    closeProductPanel();
  } else {
    openProductPanel();
  }
});

drawerBackdrop.addEventListener('click', closeProductPanel);

document.getElementById('product-list').addEventListener('click', () => {
  if (window.innerWidth <= 768) closeProductPanel();
});


// ── Pricing panel open/close ──────────────────────────────────────────────────
const pricingPanel  = document.getElementById('pricing-panel');
const btnTotalPill  = document.getElementById('btn-total-pill');
const btnQuoteClose = document.getElementById('btn-quote-close');

function openPricingPanel() {
  pricingPanel.classList.add('open');
}
function closePricingPanel() {
  pricingPanel.classList.remove('open');
}

btnTotalPill.addEventListener('click', () => {
  if (pricingPanel.classList.contains('open')) {
    closePricingPanel();
  } else {
    openPricingPanel();
  }
});

btnQuoteClose.addEventListener('click', closePricingPanel);


// ── Sync total pill with quote total ──────────────────────────────────────────
const _originalUpdateQuote = updateQuote;
updateQuote = function () {
  _originalUpdateQuote();
  const totalText = document.getElementById('total-price').textContent;
  document.getElementById('btn-total-pill').textContent = totalText;
};

updateQuote();

// ══════════════════════════════════════════════════════════════════
//  GLIDE DRAW — drag/glide to trace walls with mouse or touch
// ══════════════════════════════════════════════════════════════════

let glideActive       = false;   // currently recording a glide
let glideWasPinching = false;
const glidePointers = new Map();
let glidePoints       = [];      // raw Vector3 sampled during drag
let glidePointerDown  = false;
let glideAnimId       = null;
let glidePreviewLines = [];      // live THREE.Line objects shown while dragging
let glideCursorLine   = null;

// Minimum distance (metres) between sampled points — prevents too many
// points on slow drags while still capturing corners accurately
const GLIDE_SAMPLE_DIST = mm(150);

// Minimum wall segment length to bother building
const GLIDE_MIN_SEG = mm(100);

// How close the end must be to the start to auto-close the room (metres)
const GLIDE_CLOSE_THRESH = mm(400);


function startGlideDraw() {
  // ── Force 2D view ──────────────────────────────────────
  if (is3D) {
    is3D = false;
    if (!camera2D.userData.initialised) {
      camera2D.position.set(0, 50, 0);
      camera2D.up.set(0, 0, -1);
      camera2D.lookAt(0, 0, 0);
      camera2D.userData.initialised = true;
    }
    updateOrtho();
    activeCamera = camera2D;
    controls.enabled = false;
    document.getElementById('btn-toggle-view').textContent = '3D';
    update2DLabelVisibility();
    rebuild2DWallOverlays();
  }

  drawModeActive   = 'glide';
  mode             = 'draw-glide';
  glideActive      = false;
  glidePoints      = [];
  controls.enabled = false;   // lock orbit/pan — no view movement during glide
  isPanning2D      = false;   // kill any active 2D pan
  activeTouches.clear();
  lastPinchDist    = null;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';
  document.getElementById('btn-draw-wall').style.background = '#ff9500';
  document.getElementById('btn-draw-wall').style.color      = '#fff';
  showConfirmBar('Hold & drag to draw walls · release to finish');
}


function stopGlideDraw() {
  glideActive      = false;
  glidePointerDown = false;
  glideWasPinching = false;
  glidePointers.clear();

  canvas.style.touchAction = '';
  controls.enabled = false;

  canvas.style.cursor = 'default';
  clearGlidePreview();
  document.getElementById('btn-draw-wall').style.background = '';
  document.getElementById('btn-draw-wall').style.color      = '';
  hideConfirmBar();
  mode           = 'select';
  drawModeActive = null;
}


// ── Sampling helper ───────────────────────────────────────────────

function glideAddPoint(clientX, clientY) {
  const pt = getFloorPos({ clientX, clientY });
  if (!pt) return;
  const snapped = snapToGrid(pt);

  if (glidePoints.length === 0) {
    glidePoints.push(snapped.clone());
    return;
  }

  const last = glidePoints[glidePoints.length - 1];
  if (last.distanceTo(snapped) >= GLIDE_SAMPLE_DIST) {
    glidePoints.push(snapped.clone());
    updateGlidePreview();
  }
}

// ── Live preview while dragging ───────────────────────────────────

function clearGlidePreview() {
  glidePreviewLines.forEach(l => scene.remove(l));
  glidePreviewLines = [];
  if (glideCursorLine) { scene.remove(glideCursorLine); glideCursorLine = null; }
}


function updateGlidePreview() {
  clearGlidePreview();
  if (glidePoints.length < 2) return;

  for (let i = 0; i < glidePoints.length - 1; i++) {
    const a = glidePoints[i];
    const b = glidePoints[i + 1];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.03, a.z),
        new THREE.Vector3(b.x, 0.03, b.z)
      ]),
      new THREE.LineBasicMaterial({ color: 0xff9500, opacity: 0.7, transparent: true })
    );
    scene.add(line);
    glidePreviewLines.push(line);
  }

  // Show close-room hint dot when near start
  const first = glidePoints[0];
  const last  = glidePoints[glidePoints.length - 1];
  if (glidePoints.length > 3 && last.distanceTo(first) < GLIDE_CLOSE_THRESH) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    dot.position.set(first.x, 0.06, first.z);
    dot.name = '__glideCloseDot__';
    scene.add(dot);
    glidePreviewLines.push(dot);
  }
}

// ── Douglas-Peucker simplification ───────────────────────────────
// Reduces noisy glide points to clean corner points

function perpendicularDist(pt, lineA, lineB) {
  const dx = lineB.x - lineA.x;
  const dz = lineB.z - lineA.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.0001) return pt.distanceTo(lineA);
  return Math.abs(dx * (lineA.z - pt.z) - (lineA.x - pt.x) * dz) / len;
}

function douglasPeucker(pts, epsilon) {
  if (pts.length < 3) return pts;
  let maxDist  = 0;
  let maxIndex = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxDist) { maxDist = d; maxIndex = i; }
  }
  if (maxDist > epsilon) {
    const left  = douglasPeucker(pts.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(pts.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

// ── Commit glide to actual walls ──────────────────────────────────

function commitGlideDraw() {
  clearGlidePreview();

  if (glidePoints.length < 2) {
    stopGlideDraw();
    return;
  }

  const epsilon    = mm(300);
  const simplified  = douglasPeucker(glidePoints, epsilon);
  const ortho       = orthogonalisePoints(simplified);
  const welded      = weldCorners(ortho);
  const reortho     = orthogonalisePoints(welded);
  const isRect      = isRoughlyRectangular(reortho);
  const clean       = isRect ? makeCleanRect(reortho) : reortho;
  const first = clean[0];
  let last  = clean[clean.length - 1];

  // Rectangles are always closed loops — skip snap logic entirely
  let shouldClose;
  if (isRect) {
    shouldClose = true;
  } else {
    shouldClose = clean.length >= 3 &&
      first.distanceTo(last) < GLIDE_CLOSE_THRESH * 2;

    if (shouldClose) {
      // Orthogonal approach into first
      const prev = clean[clean.length - 2] || clean[0];
      const adx = Math.abs(prev.x - first.x);
      const adz = Math.abs(prev.z - first.z);
      if (adx >= adz) {
        clean[clean.length - 1] = new THREE.Vector3(last.x, last.y, first.z);
      } else {
        clean[clean.length - 1] = new THREE.Vector3(first.x, last.y, last.z);
      }
      last = clean[clean.length - 1];
    }
  }

  const builtWalls = [];

  if (shouldClose) {
    // For rectangles, use all 4 points as-is
    // For freehand close, drop last if it collided with first during snap
    const pts = (!isRect && clean[clean.length - 1].distanceTo(clean[0]) < mm(150))
      ? clean.slice(0, -1)
      : clean;

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a.distanceTo(b) > mm(50)) {
        const w = buildWall(a.clone(), b.clone(), true);
        if (w) builtWalls.push(w);
      }
    }
    lockRoom();

  } else {
    for (let i = 0; i < clean.length - 1; i++) {
      const w = buildWall(clean[i].clone(), clean[i + 1].clone(), true);
      if (w) builtWalls.push(w);
    }
  }


  if (builtWalls.length > 0) {
    undoStack.push({ type: 'add-wall-batch', data: { walls: builtWalls } });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  glidePoints = [];
  stopGlideDraw();
}


// ── Pointer events (works for both mouse and touch) ───────────────

// ── Glide Draw — clean pointer listeners ─────────────────────────────────────

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'draw-glide') return;
  e.preventDefault();
  e.stopPropagation();
  canvas.setPointerCapture(e.pointerId);
  glidePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  isPanning2D = false;

  if (glidePointers.size === 2) {
    // Second finger arrived — pause drawing, enter pinch mode
    glideWasPinching = true;
    glideActive = false;
  }

  if (glidePointers.size === 1 && !glideWasPinching) {
    // Fresh first finger, no prior pinch
    glideActive = true;
    glidePoints = [];
    glideAddPoint(e.clientX, e.clientY);
  }
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'draw-glide') return;
  e.preventDefault();
  e.stopPropagation();
  glidePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (glidePointers.size === 2) {
    // Two-finger pinch: zoom only, no drawing
    const pts = Array.from(glidePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastPinchDist !== null) {
      const delta = lastPinchDist - dist;
      orthoSize = Math.max(0.5, Math.min(30, orthoSize + delta * 0.01));
      updateOrtho();
    }
    lastPinchDist = dist;
    if (glideCursorLine) { scene.remove(glideCursorLine); glideCursorLine = null; }
    return;
  }

  // Single finger: draw
  if (glidePointers.size === 1 && glideActive) {
    glideAddPoint(e.clientX, e.clientY);

    if (glidePoints.length >= 1) {
      const pt = getFloorPos({ clientX: e.clientX, clientY: e.clientY });
      if (pt) {
        let last  = glidePoints[glidePoints.length - 1];
        const first = glidePoints[0];

        // Snap tail to first point when close enough to close room
        let snapped = false;
        if (first && pt.distanceTo(first) < GLIDE_CLOSE_THRESH) {
          snapped = true;
          const adx = Math.abs(last.x - first.x);
          const adz = Math.abs(last.z - first.z);
          if (adx >= adz) {
            last = new THREE.Vector3(last.x, last.y, first.z);
          } else {
            last = new THREE.Vector3(first.x, last.y, last.z);
          }
          pt.set(first.x, first.y, first.z);
        }

        const tailColor = snapped ? 0x00ff88 : 0xffdd44;

        if (glideCursorLine) scene.remove(glideCursorLine);
        glideCursorLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(last.x, 0.035, last.z),
            new THREE.Vector3(pt.x,   0.035, pt.z)
          ]),
          new THREE.LineBasicMaterial({ color: tailColor, opacity: 0.75, transparent: true })
        );
        scene.add(glideCursorLine);
      }
    }
  }
}, { passive: false });


canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'draw-glide') return
  e.preventDefault();
  e.stopPropagation();
  glidePointers.delete(e.pointerId);

  if (glidePointers.size < 2) lastPinchDist = null;

  if (glidePointers.size === 1 && glideWasPinching) {
    // One finger left after pinch — resume drawing
    glideWasPinching = false;
    glideActive = true;
    return;
  }

  if (glidePointers.size === 0 && !glideWasPinching) {
    // All fingers up, no pinch — commit
    glideAddPoint(e.clientX, e.clientY);
    commitGlideDraw();
  }

  if (glidePointers.size === 0 && glideWasPinching) {
    // Both fingers lifted from pinch — wait for new touch
    glideWasPinching = false;
    glideActive = false;
  }
}, { passive: false });

canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'draw-glide') return;
  glidePointers.delete(e.pointerId);
  if (glidePointers.size === 0) commitGlideDraw();
});





// redeploy trigger

// ── Save / Load helpers ──────────────────────────────
// ── Save / Load helpers ───────────────────────────────────────────────────────

function serialiseScene() {
  let skippedImportedCount = 0;

  const wallsData = walls.map(w => ({
    start: { x: w.start.x, z: w.start.z },
    end:   { x: w.end.x,   z: w.end.z   },
    color:   wallBaseColor(w),
    opacity: (w.opacity != null ? w.opacity : 1),
    openings: (w.openings || []).map(op => ({
      type:        op.type,
      width:       op.width,
      height:      op.height,
      distFromLeft: op.distFromLeft,
      floorDist:   op.floorDist,
    })),
  }));

  const itemsData = [];
  placedItems.forEach(mesh => {
    const product = mesh.userData?.product;
    if (!product) return;
    // Skip imported GLBs (Phase 0)
    if (product.id && product.id.startsWith('imported-')) {
      skippedImportedCount++;
      return;
    }
    // Skip opening meshes (doors/windows — they're reconstructed from wall data)
    if (mesh.userData.type === 'door' || mesh.userData.type === 'window') return;
    // Skip items with no variantId (can't round-trip to Shopify)
    const sku = product.skus?.[mesh.userData.skuIndex ?? 0];
    if (!sku?.variantId) return;

    itemsData.push({
      productHandle: product.id,
      variantId:     sku.variantId,
      position: {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      },
      rotationY: mesh.rotation.y,
      skuIndex:  mesh.userData.skuIndex ?? 0,
    });
  });

  const sceneJson = {
    version: 1,
    settings: {
      ceilingHeight: settings.ceilingHeight,
      wallThickness: settings.wallThickness,
      gridSize:      settings.gridSize,
    },
    walls: wallsData,
    items: itemsData,
    camera: {
      is3D:       is3D,
      position3D: { x: camera3D.position.x, y: camera3D.position.y, z: camera3D.position.z },
      target3D:   { x: controls.target.x,   y: controls.target.y,   z: controls.target.z   },
      orthoSize:  orthoSize,
    },
  };

  // Generate thumbnail — one render, then capture
  renderer.render(scene, activeCamera);
  const thumbnail = renderer.domElement.toDataURL('image/png');

  return { sceneJson, thumbnail, skippedImportedCount };
}


function clearScene() {
  // Dispose and remove all walls
  [...walls].forEach(w => {
    scene.remove(w.mesh);
    if (w.mesh.geometry) w.mesh.geometry.dispose();
    if (w.mesh.material) w.mesh.material.dispose();
    if (w.capMeshes) w.capMeshes.forEach(c => {
      scene.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    if (w.label2D) wall2DLabelGroup.remove(w.label2D);
  });
  walls = [];

  // Dispose and remove all placed items
  [...placedItems].forEach(mesh => {
    scene.remove(mesh);
    disposeModel(mesh);
  });
  placedItems = [];

  // Clear 2D labels array
  label2DObjects = [];
  while (wall2DLabelGroup.children.length > 0)
    wall2DLabelGroup.remove(wall2DLabelGroup.children[0]);

  // Clear overlays
  while (wall2DOverlayGroup.children.length > 0)
    wall2DOverlayGroup.remove(wall2DOverlayGroup.children[0]);

  // Clear history
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();

  // Hide any open popups
  hideWallPopup();
  if (labelEditor) labelEditor.style.display = 'none';

  // Reset room lock
  roomLocked = false;
  roomCorners = [];

  // Remove auto floor
  if (floorMesh) {
    scene.remove(floorMesh);
    if (floorMesh.geometry) floorMesh.geometry.dispose();
    if (floorMesh.material) floorMesh.material.dispose();
    floorMesh = null;
  }

  // Force back to select mode so taps work after clearing
  mode = 'select';
  canvas.style.cursor = 'default';

  updateRoomArea();
  updateQuote();
}

function loadScene(sceneJson) {
  if (!sceneJson || sceneJson.version !== 1) {
    console.warn('[loadScene] unrecognised scene version', sceneJson?.version);
    return;
  }

  clearScene();

  // Restore settings
  if (sceneJson.settings) {
    settings.ceilingHeight = sceneJson.settings.ceilingHeight ?? settings.ceilingHeight;
    settings.wallThickness = sceneJson.settings.wallThickness ?? settings.wallThickness;
    settings.gridSize      = sceneJson.settings.gridSize      ?? settings.gridSize;
  }

  // Rebuild walls (skipHistory = true so undo stack stays clean)
  (sceneJson.walls || []).forEach(wd => {
    const start = new THREE.Vector3(wd.start.x, 0, wd.start.z);
    const end   = new THREE.Vector3(wd.end.x,   0, wd.end.z);
    const wallObj = buildWall(start, end, true);
    if (!wallObj) return;

    // Restore saved colour / opacity
    if (wd.color   != null) wallObj.baseColor = wd.color;
    if (wd.opacity != null) wallObj.opacity   = wd.opacity;
    applyWallVisual(wallObj);

    // Attach openings and sync to 3D
    if (wd.openings && wd.openings.length > 0) {
      wallObj.openings = wd.openings.map(op => ({ ...op }));
      syncOpeningsTo3D(wallObj);
    }
  });

  // Rebuild floor if walls form a closed loop
  buildFloorMesh();

  // Rebuild items
  (sceneJson.items || []).forEach(item => {
    const product = products.find(p => p.id === item.productHandle);
    if (!product) {
      console.warn('[loadScene] product not found, skipping:', item.productHandle);
      return;
    }

    // placeProduct creates the mesh and adds it to scene + placedItems
    placeProduct(product);

    // Grab the mesh that was just pushed onto placedItems
    const mesh = placedItems[placedItems.length - 1];
    if (!mesh) return;

    // Restore transform
    mesh.position.set(item.position.x, item.position.y, item.position.z);
    mesh.rotation.y = item.rotationY;
    mesh.userData.skuIndex = item.skuIndex ?? 0;
  });

  // Restore camera
  if (sceneJson.camera) {
    const cam = sceneJson.camera;

    // Switch 2D / 3D
    if (cam.is3D !== undefined && cam.is3D !== is3D) {
      is3D = cam.is3D;
      if (is3D) {
        activeCamera = camera3D;
        controls.enabled = true;
      } else {
        if (!camera2D.userData.initialised) {
          camera2D.position.set(0, 50, 0);
          camera2D.up.set(0, 0, -1);
          camera2D.lookAt(0, 0, 0);
          camera2D.userData.initialised = true;
        }
        activeCamera = camera2D;
        controls.enabled = false;
      }
      document.getElementById('btn-toggle-view').textContent = is3D ? '2D' : '3D';
      update2DLabelVisibility();
      rebuild2DWallOverlays();
    }

    // Restore 3D camera position + orbit target
    if (cam.position3D) {
      camera3D.position.set(cam.position3D.x, cam.position3D.y, cam.position3D.z);
    }
    if (cam.target3D) {
      controls.target.set(cam.target3D.x, cam.target3D.y, cam.target3D.z);
      controls.update();
    }

    // Restore 2D zoom
    if (cam.orthoSize) {
      orthoSize = cam.orthoSize;
      updateOrtho();
    }
  }

  // REPLACE WITH:
  // Rebuild derived scene state
  rebuildAllCaps();
  refreshAll2DLabels();
  rebuild2DWallOverlays();
  update2DLabelVisibility();
  updateRoomArea();
  updateQuote();
  updateUndoRedoButtons();

  // Force back to select mode so taps work immediately after load
  mode = 'select';
  canvas.style.cursor = 'default';
}


window._debug = { serialiseScene, clearScene, loadScene };

// ── Auth modal open/close ─────────────────────────────────────────────────────


const authModal = document.getElementById('auth-modal');

document.getElementById('btn-auth').addEventListener('click', () => {
  closeHamburgerMenu();
  authModal.style.display = 'flex';
});

document.getElementById('btn-auth-close').addEventListener('click', () => {
  authModal.style.display = 'none';
});

document.getElementById('btn-google-signin').addEventListener('click', () => {
  signInWithGoogle();
});

document.getElementById('btn-auth-signout').addEventListener('click', async () => {
  await signOut();
  authModal.style.display = 'none';
});

// ── Desktop item panel ────────────────────────────────────────────────────────
const desktopItemPanel = document.createElement('div');
desktopItemPanel.style.cssText = [
  'display:none;position:fixed;top:60px;right:12px;',
  'width:200px;background:#1e1e1e;border:1px solid #ff9500;',
  'border-radius:12px;z-index:400;overflow:hidden;',
  'box-shadow:0 4px 20px rgba(0,0,0,0.5);font-family:Arial;'
].join('');
desktopItemPanel.innerHTML = [
  '<div style="background:#2a2a2a;padding:10px 14px;border-bottom:1px solid #333;',
  'color:#ff9500;font-weight:bold;font-size:13px;display:flex;',
  'justify-content:space-between;align-items:center;">',
  '<span id="dip-title">Cabinet</span>',
  '<span id="dip-close" style="cursor:pointer;color:#aaa;font-size:16px;',
  'padding:2px 6px;">✕</span></div>',
  '<div style="display:flex;flex-direction:column;padding:8px;gap:6px;">',
  '<button id="dip-rotate" style="background:#2a2a2a;color:#fff;border:1px solid #333;',
  'border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;text-align:left;">',
  '🔄 Rotate 90°</button>',
  '<button id="dip-duplicate" style="background:#2a2a2a;color:#fff;border:1px solid #333;',
  'border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;text-align:left;">',
  '⧉ Duplicate</button>',
  '<button id="dip-ruler" style="background:#2a2a2a;color:#fff;border:1px solid #333;',
  'border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;text-align:left;">',
  '📏 Measure</button>',
  '<div id="dip-ruler-readout" style="display:none;padding:6px 8px;background:#111;',
  'border-radius:6px;font-size:11px;color:#aaa;white-space:pre-line;"></div>',
  '<button id="dip-delete" style="background:#2a2a2a;color:#c0392b;border:1px solid #444;',
  'border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;text-align:left;">',
  '🗑 Delete</button>',
  '</div>'
].join('');
document.body.appendChild(desktopItemPanel);

let desktopSelectedModel = null;

function showDesktopItemPanel(model) {
  desktopSelectedModel = model;
  const name = model.userData?.product?.name || 'Cabinet';
  document.getElementById('dip-title').textContent = name;
  document.getElementById('dip-ruler-readout').style.display = 'none';
  desktopItemPanel.style.display = 'block';
}

function hideDesktopItemPanel() {
  desktopItemPanel.style.display = 'none';
  desktopSelectedModel = null;
}

document.getElementById('dip-close').addEventListener('click', hideDesktopItemPanel);

document.getElementById('dip-rotate').addEventListener('click', () => {
  if (!desktopSelectedModel) return;
  desktopSelectedModel.rotation.y += Math.PI / 2;
});

document.getElementById('dip-duplicate').addEventListener('click', () => {
  if (!desktopSelectedModel) return;
  const clone = desktopSelectedModel.clone();
  clone.position.set(
    desktopSelectedModel.position.x + 0.2,
    desktopSelectedModel.position.y,
    desktopSelectedModel.position.z + 0.2
  );
  clone.userData = { ...desktopSelectedModel.userData };
  scene.add(clone);
  placedItems.push(clone);
  pushHistory({ type: 'add-item', data: { mesh: clone } });
  updateQuote();
});

document.getElementById('dip-ruler').addEventListener('click', () => {
  if (!desktopSelectedModel) return;
  const readout = document.getElementById('dip-ruler-readout');
  if (readout.style.display === 'block') {
    readout.style.display = 'none';
    return;
  }
  readout.textContent = measureToNearestWall(desktopSelectedModel);
  readout.style.display = 'block';
});

document.getElementById('dip-delete').addEventListener('click', () => {
  if (!desktopSelectedModel) return;
  pushHistory({ type: 'delete-item', data: { mesh: desktopSelectedModel } });
  deselectCabinet(desktopSelectedModel);
  scene.remove(desktopSelectedModel);
  placedItems = placedItems.filter(x => x !== desktopSelectedModel);
  updateQuote();
  hideDesktopItemPanel();
});

initAuth();
animate();

// ── Save Project button wiring ────────────────────────────────────────────────
document.getElementById('btn-save-project').addEventListener('click', async () => {
  const defaultName = 'Kitchen - ' + new Date().toLocaleDateString('en-NZ');
  const name = prompt('Project name:', defaultName);
  if (!name || !name.trim()) return;
  const { sceneJson, thumbnail, skippedImportedCount } = serialiseScene();
  // Close the auth modal so the toast is visible
  document.getElementById('auth-modal').style.display = 'none';
  const { id, error } = await saveProject(name.trim(), sceneJson, thumbnail);
  if (error) {
    showImportToast('Save failed: ' + error, true);
    return;
  }
  showImportToast('Saved ✓');
  if (skippedImportedCount > 0) {
    setTimeout(() => {
      showImportToast(skippedImportedCount + ' imported GLBs not saved (Phase 1)', true);
    }, 600);
  }
});
// ── My Projects modal wiring ──────────────────────────────────────────────────
const projectsModal     = document.getElementById('projects-modal');
const projectsList      = document.getElementById('projects-list');
const btnMyProjects     = document.getElementById('btn-my-projects');
const btnProjectsClose  = document.getElementById('btn-projects-close');

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const sec  = Math.max(1, Math.round((now - then) / 1000));
  if (sec < 60)        return sec + ' second' + (sec === 1 ? '' : 's') + ' ago';
  const min = Math.round(sec / 60);
  if (min < 60)        return min + ' minute' + (min === 1 ? '' : 's') + ' ago';
  const hr  = Math.round(min / 60);
  if (hr  < 24)        return hr  + ' hour'   + (hr  === 1 ? '' : 's') + ' ago';
  const day = Math.round(hr / 24);
  if (day < 7)         return day + ' day'    + (day === 1 ? '' : 's') + ' ago';
  const wk  = Math.round(day / 7);
  if (wk  < 5)         return wk  + ' week'   + (wk  === 1 ? '' : 's') + ' ago';
  const mo  = Math.round(day / 30);
  if (mo  < 12)        return mo  + ' month'  + (mo  === 1 ? '' : 's') + ' ago';
  const yr  = Math.round(day / 365);
  return yr + ' year' + (yr === 1 ? '' : 's') + ' ago';
}

function renderProjectsList(rows) {
  projectsList.innerHTML = '';

  if (!rows || rows.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:48px 20px;color:#888;font-size:13px;text-align:center;';
    empty.innerHTML = '<div style="font-size:32px;margin-bottom:8px">📁</div>No saved projects yet.<br><span style="font-size:11px;color:#666">Save your first kitchen to see it here.</span>';
    projectsList.appendChild(empty);
    return;
  }

  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'proj-row';

    // Thumbnail (or grey fallback)
    const thumb = document.createElement(row.thumbnail ? 'img' : 'div');
    thumb.className = 'proj-thumb';
    if (row.thumbnail) thumb.src = row.thumbnail;

    // Info
    const info = document.createElement('div');
    info.className = 'proj-info';
    const name = document.createElement('div');
    name.className = 'proj-name';
    name.textContent = row.name;
    const time = document.createElement('div');
    time.className = 'proj-time';
    time.textContent = relativeTime(row.updated_at);
    info.appendChild(name);
    info.appendChild(time);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'proj-actions';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'proj-btn-load';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => handleLoadProject(row.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'proj-btn-delete';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', () => handleDeleteProject(row.id, row.name));

    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);

    div.appendChild(thumb);
    div.appendChild(info);
    div.appendChild(actions);
    projectsList.appendChild(div);
  });
}

async function openProjectsModal() {
  // Close auth modal first so the projects modal is the focused surface
  document.getElementById('auth-modal').style.display = 'none';

  projectsModal.style.display = 'flex';
  projectsList.innerHTML =
    '<div style="padding:48px 20px;color:#888;font-size:13px;text-align:center;">Loading…</div>';

  const { data, error } = await listProjects();
  if (error) {
    projectsList.innerHTML =
      '<div style="padding:48px 20px;color:#c0392b;font-size:13px;text-align:center;">' +
      'Failed to load projects.<br><span style="font-size:11px;color:#888">' + error + '</span></div>';
    return;
  }
  renderProjectsList(data);
}

function closeProjectsModal() {
  projectsModal.style.display = 'none';
}

async function handleLoadProject(id) {
  const hasScene = walls.length > 0 || placedItems.length > 0;
  if (hasScene && !confirm('Discard current scene and load this project?')) return;

  const { data, error } = await loadProject(id);
  if (error) {
    showImportToast('Load failed: ' + error, true);
    return;
  }
  if (!data?.scene_json) {
    showImportToast('Project has no scene data', true);
    return;
  }

  loadScene(data.scene_json);
  closeProjectsModal();
  showImportToast('Loaded ✓');
}

async function handleDeleteProject(id, name) {
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;

  const { error } = await deleteProject(id);
  if (error) {
    showImportToast('Delete failed: ' + error, true);
    return;
  }
  showImportToast('Deleted');

  // Re-fetch and re-render
  const { data, error: listErr } = await listProjects();
  if (listErr) {
    projectsList.innerHTML =
      '<div style="padding:48px 20px;color:#c0392b;font-size:13px;text-align:center;">' +
      listErr + '</div>';
    return;
  }
  renderProjectsList(data);
}

btnMyProjects.addEventListener('click', openProjectsModal);
btnProjectsClose.addEventListener('click', closeProjectsModal);

// Close on backdrop tap
projectsModal.addEventListener('click', (e) => {
  if (e.target === projectsModal) closeProjectsModal();
});

// Close on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && projectsModal.style.display === 'flex') {
    closeProjectsModal();
  }
});

// ── 1.3 Mobile Toolbar — camera capture + hamburger menu ─────────────────────

// 📷 Camera capture — saves current canvas view as PNG
document.getElementById('btn-camera').addEventListener('click', () => {
  renderer.render(scene, activeCamera);
  const url = renderer.domElement.toDataURL('image/png');
  const a   = document.createElement('a');
  a.href     = url;
  a.download = 'kitchen-view.png';
  a.click();
});

// ☰ Hamburger menu — open/close
const btnHamburger  = document.getElementById('btn-hamburger');
const hamburgerMenu = document.getElementById('hamburger-menu');

function openHamburgerMenu() {
  hamburgerMenu.style.display = 'flex';
  btnHamburger.classList.add('active');
}
function closeHamburgerMenu() {
  hamburgerMenu.style.display = 'none';
  btnHamburger.classList.remove('active');
}

btnHamburger.addEventListener('click', (e) => {
  e.stopPropagation();
  hamburgerMenu.style.display === 'flex' ? closeHamburgerMenu() : openHamburgerMenu();
});

// Dismiss when tapping outside the menu
document.addEventListener('click', (e) => {
  if (hamburgerMenu.style.display === 'flex' &&
      !hamburgerMenu.contains(e.target) &&
      e.target !== btnHamburger) {
    closeHamburgerMenu();
  }
});

// Close menu on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHamburgerMenu();
});

// Hamburger menu items — delegate to existing toolbar buttons
document.getElementById('hmenu-wall-xray').addEventListener('click', () => {
  closeHamburgerMenu();
  setWallXray(!wallXray);
});
document.getElementById('hmenu-import-glb').addEventListener('click', () => {
  closeHamburgerMenu();
  glbFileInput.click();
});

// ── Touch Modifier Dock ──────────────────────────────────────────────────────

/** Returns true when keyboard Shift OR the touch shift button is active. */
function isShiftModifierActive() {
  return shiftDown || touchShiftActive;
}

/** Returns true when the touch cam-lock toggle is active. */
function isTouchCameraLocked() {
  return touchCamLock;
}

/**
 * Returns true when the camera should be locked for the current touch context.
 * Quick Draw always locks; Select mode locks only when cam-lock is toggled on.
 * Free Draw manages its own controls.enabled — not included here.
 */
function shouldLockCameraForCurrentTouchMode() {
  if (!IS_TOUCH) return false;
  if (drawModeActive === 'quick') return true;
  if (mode === 'select' && touchCamLock) return true;
  return false;
}

function loadTouchModifierPrefs() {
  const raw = {
    top:       parseFloat(localStorage.getItem(TM_LS_TOP)),
    collapsed: localStorage.getItem(TM_LS_COLLAPSED) === '1',
    camlock:   localStorage.getItem(TM_LS_CAMLOCK)   === '1',
  };
  return raw;
}

function saveTouchModifierPrefs() {
  const dock = document.getElementById('touch-modifier-dock');
  const top  = parseFloat(dock.style.top) || 0;
  localStorage.setItem(TM_LS_TOP,       top);
  localStorage.setItem(TM_LS_COLLAPSED, touchModifierCollapsed ? '1' : '0');
  localStorage.setItem(TM_LS_CAMLOCK,   touchCamLock           ? '1' : '0');
}

function clampTouchModifierDock(top) {
  const dockH = document.getElementById('touch-modifier-inner').offsetHeight || 180;
  return Math.max(0, Math.min(window.innerHeight - dockH, top));
}

/** Wake the dock from idle; restarts the 2-second fade timer. */
function _resetTmIdleTimer() {
  const dock    = document.getElementById('touch-modifier-dock');
  const restore = document.getElementById('touch-modifier-restore');
  dock.classList.remove('tm-idle');
  restore.classList.remove('tm-idle');
  clearTimeout(_tmIdleTimer);
  _tmIdleTimer = setTimeout(() => {
    dock.classList.add('tm-idle');
    restore.classList.add('tm-idle');
  }, TM_IDLE_MS);
}

/** Show one-time onboarding hint beside the dock. */
function showTouchModifierHint(dockTop) {
  if (localStorage.getItem(TM_LS_HINT_SEEN)) return;
  const el = document.createElement('div');
  el.id = 'touch-modifier-hint';
  el.style.top = (dockTop + 4) + 'px';
  el.innerHTML =
    '<div id="touch-modifier-hint-inner">' +
      '<div class="tmh-line">⇧ <b>Hold Shift</b> for snap &amp; multi-select</div>' +
      '<div class="tmh-line">🔒 <b>Cam</b> toggles view lock</div>' +
      '<div class="tmh-dismiss">tap to dismiss</div>' +
    '</div>';
  el.addEventListener('pointerdown', dismissTouchModifierHint, { once: true });
  document.body.appendChild(el);
  setTimeout(dismissTouchModifierHint, 5000);
}

function dismissTouchModifierHint() {
  localStorage.setItem(TM_LS_HINT_SEEN, '1');
  const el = document.getElementById('touch-modifier-hint');
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 320); }
}

function updateTouchModifierUI() {
  const dock    = document.getElementById('touch-modifier-dock');
  const restore = document.getElementById('touch-modifier-restore');
  const shiftBtn  = document.getElementById('btn-touch-shift');
  const camlockBtn = document.getElementById('btn-touch-camlock');

  if (touchModifierCollapsed) {
    dock.style.display    = 'none';
    restore.style.display = 'flex';
    restore.style.top     = dock.style.top;
  } else {
    dock.style.display    = '';
    restore.style.display = 'none';
  }

  shiftBtn.classList.toggle('active',    touchShiftActive);
  shiftBtn.classList.toggle('tm-latched', touchShiftLatched);
  shiftBtn.title = touchShiftLatched ? 'Shift Latched — tap to release'
                 : touchShiftActive  ? 'Shift Active — release to cancel'
                 : 'Shift — hold for snap & multi-select; double-tap to latch';
  shiftBtn.setAttribute('aria-pressed', touchShiftActive ? 'true' : 'false');

  camlockBtn.classList.toggle('active', touchCamLock);
  camlockBtn.title = touchCamLock ? 'Camera Locked — tap to unlock' : 'Lock Camera';
  camlockBtn.setAttribute('aria-pressed', touchCamLock ? 'true' : 'false');
}

function initTouchModifierDock() {
  // Only show on touch/coarse-pointer devices
  if (!IS_TOUCH) {
    document.getElementById('touch-modifier-dock').style.display    = 'none';
    document.getElementById('touch-modifier-restore').style.display = 'none';
    return;
  }

  const prefs = loadTouchModifierPrefs();
  touchModifierCollapsed = prefs.collapsed;
  touchCamLock           = prefs.camlock;

  const dock    = document.getElementById('touch-modifier-dock');
  const restore = document.getElementById('touch-modifier-restore');
  const savedTop = isNaN(prefs.top) ? window.innerHeight * 0.35 : prefs.top;
  dock.style.top = clampTouchModifierDock(savedTop) + 'px';

  updateTouchModifierUI();
  _resetTmIdleTimer();

  // ── One-time onboarding hint ───────────────────────────
  showTouchModifierHint(parseFloat(dock.style.top));

  // ── Shift button: press-and-hold + double-tap latch ────
  const shiftBtn = document.getElementById('btn-touch-shift');
  shiftBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    _resetTmIdleTimer();
    const now = Date.now();
    if (touchShiftLatched) {
      // Already latched: single tap unlatches and releases
      touchShiftLatched = false;
      touchShiftActive  = false;
    } else if (now - _tmLastShiftDown < 400) {
      // Double-tap within 400 ms: latch on (sticky until next tap)
      touchShiftLatched = true;
      touchShiftActive  = true;
    } else {
      // Normal press-and-hold
      touchShiftActive = true;
    }
    _tmLastShiftDown = now;
    updateTouchModifierUI();
  });
  const _releaseShift = () => {
    if (touchShiftLatched) return;   // stay active when latched
    if (!touchShiftActive) return;
    touchShiftActive = false;
    updateTouchModifierUI();
  };
  shiftBtn.addEventListener('pointerup',     _releaseShift);
  shiftBtn.addEventListener('pointercancel', _releaseShift);
  shiftBtn.addEventListener('pointerleave',  _releaseShift);

  // ── Cam Lock toggle ────────────────────────────────────
  document.getElementById('btn-touch-camlock').addEventListener('click', () => {
    if (_tmDragMovedPx > 8) return;   // ignore if drag just ended here
    _resetTmIdleTimer();
    touchCamLock = !touchCamLock;
    updateTouchModifierUI();
    saveTouchModifierPrefs();
    // Apply to OrbitControls when in select mode.
    // Quick Draw manages its own controls.enabled lock independently.
    if (mode === 'select') controls.enabled = !touchCamLock;
  });

  // ── Collapse ───────────────────────────────────────────
  document.getElementById('btn-touch-mod-hide').addEventListener('click', () => {
    if (_tmDragMovedPx > 8) return;   // ignore if drag just ended here
    _resetTmIdleTimer();
    touchModifierCollapsed = true;
    updateTouchModifierUI();
    saveTouchModifierPrefs();
  });

  // ── Restore tab ────────────────────────────────────────
  restore.addEventListener('click', () => {
    _resetTmIdleTimer();
    touchModifierCollapsed = false;
    updateTouchModifierUI();
    saveTouchModifierPrefs();
  });

  // ── Vertical drag by handle ────────────────────────────
  const handle = document.getElementById('touch-modifier-handle');
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    _tmDragMovedPx  = 0;
    _tmDragActive   = true;
    _tmDragStartY   = e.clientY;
    _tmDragStartTop = parseFloat(dock.style.top) || 0;
    handle.setPointerCapture(e.pointerId);
    _resetTmIdleTimer();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!_tmDragActive) return;
    const dy = e.clientY - _tmDragStartY;
    _tmDragMovedPx = Math.abs(dy);
    dock.style.top = clampTouchModifierDock(_tmDragStartTop + dy) + 'px';
  });
  const _endDrag = () => {
    if (!_tmDragActive) return;
    _tmDragActive = false;
    saveTouchModifierPrefs();
    _resetTmIdleTimer();
    // Brief window so button-click guard above sees the movement distance.
    setTimeout(() => { _tmDragMovedPx = 0; }, 150);
  };
  handle.addEventListener('pointerup',     _endDrag);
  handle.addEventListener('pointercancel', _endDrag);

  // ── Re-clamp on resize / orientation change ────────────
  const _tmReClamp = () => {
    const cur = parseFloat(dock.style.top) || 0;
    dock.style.top = clampTouchModifierDock(cur) + 'px';
    updateTouchModifierUI();   // re-syncs restore tab top
  };
  window.addEventListener('resize',            _tmReClamp);
  window.addEventListener('orientationchange', _tmReClamp);
}

initTouchModifierDock();

// ── Theme switcher ──────────────────────────────────────────────────────────
const THEMES = [
  { id: 'dark',   icon: '🌑', label: 'Dark',   sceneBg: 0x1a1a1a },
  { id: 'gaming', icon: '🎮', label: 'Gaming', sceneBg: 0x0a0a0f },
  { id: 'light',  icon: '☀️', label: 'Light',  sceneBg: 0xe8e8e8 },
];
let themeIndex = Math.min(parseInt(localStorage.getItem('bbk-theme') || '0', 10) || 0, THEMES.length - 1);

function applyTheme(idx) {
  themeIndex = ((idx % THEMES.length) + THEMES.length) % THEMES.length;
  const t = THEMES[themeIndex];
  document.body.classList.remove('theme-gaming', 'theme-light');
  if (t.id !== 'dark') document.body.classList.add('theme-' + t.id);
  scene.background = new THREE.Color(t.sceneBg);

  // Light theme: hide grid, show solid floor plane; all others: show grid, hide plane
  if (t.id === 'light') {
    minorGrid.visible = false;
    floor.material.visible = true;
    floor.material.color.set(0xd8d8d8);
  } else {
    minorGrid.visible = true;
    floor.material.visible = false;
  }

  localStorage.setItem('bbk-theme', themeIndex);
  updateThemeMenuUI();
}

applyTheme(themeIndex); // restore saved theme on load

// ── Theme flyout (opens beside the floating 🎨 button, right edge) ────────

const themeMenuEl     = document.getElementById('theme-menu');
const btnThemeTrigger = document.getElementById('btn-theme-trigger');

function updateThemeMenuUI() {
  const t = THEMES[themeIndex];
  document.getElementById('tmenu-dark').classList.toggle('active',   t.id === 'dark');
  document.getElementById('tmenu-light').classList.toggle('active',  t.id === 'light');
  document.getElementById('tmenu-gaming').classList.toggle('active', t.id === 'gaming');
  // Trigger button shows the current theme's icon
  // (getElementById, not the const — applyTheme runs on load before it's declared)
  const trig = document.getElementById('btn-theme-trigger');
  trig.textContent = t.icon;
  trig.title = 'Theme: ' + t.label;
}

function openThemeMenu() {
  const rect = btnThemeTrigger.getBoundingClientRect();
  // Open to the left of the trigger so it stays on screen at the right edge
  themeMenuEl.style.top   = rect.top + 'px';
  themeMenuEl.style.left  = '';
  themeMenuEl.style.right = (window.innerWidth - rect.left + 8) + 'px';
  themeMenuEl.style.display = 'flex';
  btnThemeTrigger.classList.add('active');
  updateThemeMenuUI();
}
function closeThemeMenu() {
  themeMenuEl.style.display = 'none';
  btnThemeTrigger.classList.remove('active');
}

btnThemeTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  themeMenuEl.style.display === 'flex' ? closeThemeMenu() : openThemeMenu();
});

document.addEventListener('click', (e) => {
  if (themeMenuEl.style.display === 'flex' &&
      !themeMenuEl.contains(e.target) &&
      e.target !== btnThemeTrigger) {
    closeThemeMenu();
  }
});

document.getElementById('tmenu-dark').addEventListener('click',   () => { applyTheme(THEMES.findIndex(t => t.id === 'dark'));   closeThemeMenu(); });
document.getElementById('tmenu-light').addEventListener('click',  () => { applyTheme(THEMES.findIndex(t => t.id === 'light'));  closeThemeMenu(); });
document.getElementById('tmenu-gaming').addEventListener('click', () => { applyTheme(THEMES.findIndex(t => t.id === 'gaming')); closeThemeMenu(); });
