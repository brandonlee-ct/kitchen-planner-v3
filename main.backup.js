import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const mm = v => v / 1000;
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
  if (activeTouches.size === 1 && !is3D && mode !== 'draw-wall' && mode !== 'draw-freehand' && mode !== 'draw-twopoint') {
    const t = e.changedTouches[0];
    panStart.set(t.clientX, t.clientY);
    isPanning2D = true;
  }
  if (activeTouches.size === 2) {
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
      walls = walls.filter(x => x !== w);
      if (selectedWall === w) selectedWall = null;

    });
    // Add back the OLD walls (removed)
    entry.data.removed.forEach(w => {
      scene.add(w.mesh);
      if (!walls.includes(w)) walls.push(w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea();
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
      walls = walls.filter(x => x !== w);
    });
    // Add back the NEW walls (restored)
    entry.data.restored.forEach(w => {
      scene.add(w.mesh);
      if (!walls.includes(w)) walls.push(w);
    });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
    updateRoomArea();
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
let shiftDown = false;
let snapGuideH = null, snapGuideV = null;
let axisGuideX = null, axisGuideZ = null;
let roomCorners = [], roomLocked = false;
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
  if (e.key === 'Escape') cancelWallDraw();
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if (selectedWall) {
      pushHistory({ type: 'delete-wall', data: { wallObj: selectedWall } });
      scene.remove(selectedWall.mesh);
      if (selectedWall.capMeshes) selectedWall.capMeshes.forEach(c => scene.remove(c));
      if (selectedWall.label2D) wall2DLabelGroup.remove(selectedWall.label2D);
      walls = walls.filter(w => w !== selectedWall);
      rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
      updateRoomArea();
    } else if (selectedItem) {
      pushHistory({ type: 'delete-item', data: { mesh: selectedItem } });
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
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
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
      new THREE.SphereGeometry(0.15, 16, 16),
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
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(t, h, t),
      new THREE.MeshStandardMaterial({ color: 0xddd5c8 })
    );
    cap.position.set(x, h / 2, z);
    cap.castShadow = cap.receiveShadow = true;
    scene.add(cap);
    if (!wallList[0].capMeshes) wallList[0].capMeshes = [];
    wallList[0].capMeshes.push(cap);
  });
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
  mesh.position.set((start.x + end.x) / 2, h / 2, (start.z + end.z) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const wallObj = { mesh, start: start.clone(), end: end.clone(), capMeshes: [], label2D: null };
  mesh.userData.wallObj = wallObj;
  walls.push(wallObj);
  make2DLabel(wallObj);
  rebuildAllCaps();
  // ✅ FIX: rebuild 2D overlay whenever a wall is added, not just on view toggle
  rebuild2DWallOverlays();
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
wallPopup.style.cssText = 'display:none;position:fixed;z-index:200;background:#2a2a2a;border:1px solid #ff9500;border-radius:10px;padding:16px;width:260px;font-family:Arial;font-size:13px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
wallPopup.innerHTML = [
  '<div style="color:#ff9500;font-weight:bold;margin-bottom:12px">Edit Wall</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Length (mm)</label>',
  '<div style="display:flex;gap:6px;margin:4px 0 12px;align-items:center">',
  '<input id="wp-length" type="number" step="100" min="100" style="flex:1;background:#333;border:1px solid #ff9500;border-radius:6px;color:#fff;padding:8px 10px;font-size:15px;box-sizing:border-box"/>',
  '<button id="wp-bt" style="background:none;border:1px solid #555;border-radius:6px;padding:7px 9px;cursor:pointer;font-size:15px" title="Bluetooth">BT</button>',
  '<button id="wp-confirm" style="background:#ff9500;color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:bold">OK</button>',
  '</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Thickness (mm)</label>',
  '<div style="display:flex;gap:6px;margin:4px 0 12px;align-items:center">',
  '<input id="wp-thickness" type="number" step="10" min="50" max="500" style="flex:1;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:8px 10px;font-size:14px;box-sizing:border-box"/>',
  '<span style="color:#aaa;font-size:12px">mm</span>',
  '</div>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Ceiling Height</label>',
  '<select id="wp-height" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:7px 8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">',
  '<option value="2400">2400mm</option><option value="2700">2700mm</option>',
  '</select>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Type</label>',
  '<select id="wp-type" style="width:100%;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:7px 8px;font-size:13px;margin:4px 0 12px;box-sizing:border-box">',
  '<option value="110">Interior 110mm</option><option value="150">Exterior 150mm</option>',
  '</select>',
  '<div style="display:flex;gap:8px;margin-bottom:10px">',
  '<button id="wp-delete" style="flex:1;background:#c0392b;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px">Delete</button>',
  '<button id="wp-view" style="flex:1;background:#2980b9;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px">View Wall</button>',
  '</div>',
  '<hr style="border-color:#444;margin:0 0 10px"/>',
  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Wall Angle (degrees)</label>',
'<div style="display:flex;gap:6px;margin:4px 0 12px;align-items:center">',
'<input id="wp-angle" type="number" step="1" min="-360" max="360" style="flex:1;background:#333;border:1px solid #555;border-radius:6px;color:#fff;padding:8px 10px;font-size:14px;box-sizing:border-box"/>',
'<span style="color:#aaa;font-size:12px">°</span>',
'<button id="wp-angle-apply" style="background:#2980b9;color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:bold">Apply</button>',
'</div>',

  '<label style="color:#aaa;font-size:11px;text-transform:uppercase">Add Opening</label>',
  '<div style="display:flex;gap:8px;margin-top:6px">',
  '<button id="wp-door" style="flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:8px;cursor:pointer;font-size:12px">Door</button>',
  '<button id="wp-window" style="flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:8px;cursor:pointer;font-size:12px">Window</button>',
  '</div>',
  '<button id="wp-close" style="position:absolute;top:10px;right:12px;background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">X</button>'
].join('');
document.body.appendChild(wallPopup);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && wallPopup.style.display === 'block') document.getElementById('wp-confirm').click();
});

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

  const pw = 260, ph = 420;
  let x = sx + 15, y = sy - 10;
  if (x + pw > window.innerWidth)  x = sx - pw - 15;
  if (y + ph > window.innerHeight) y = window.innerHeight - ph - 10;
  wallPopup.style.left = x + 'px';
  wallPopup.style.top  = y + 'px';
  wallPopup.style.display = 'block';
  walls.forEach(w => w.mesh.material.color.set(0xddd5c8));
  wallObj.mesh.material.color.set(0xff9500);
  setTimeout(() => document.getElementById('wp-length').select(), 50);
  showWallHandles(wallObj);

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
  clearWallHandles();

  dimLabel.style.display = 'none';
  walls.forEach(w => w.mesh.material.color.set(0xddd5c8));
  selectedWall = null; hoveredWall = null;
}

document.getElementById('wp-confirm').addEventListener('click', () => {
  if (!selectedWall) return;
  const newLenM  = mm(parseFloat(document.getElementById('wp-length').value));
  const newThick = parseInt(document.getElementById('wp-thickness').value);
  settings.ceilingHeight = parseInt(document.getElementById('wp-height').value);
  settings.wallThickness = parseInt(document.getElementById('wp-type').value) || newThick;
  resizeLockedWall(selectedWall, newLenM);
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
  walls = walls.filter(w => w !== selectedWall);
  rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays(); hideWallPopup();
  updateRoomArea();
});
document.getElementById('wp-close').addEventListener('click', hideWallPopup);
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

// --- Elevation panel (unchanged from original) ---
const elevationPanel = document.createElement('div');
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

let elevWall = null, elevOpenings = [], selectedOpening = null;
let elevDragOp = null, elevDragOffsetMm = 0, elevHoveredOp = null;
const elevCanvas = document.getElementById('elev-canvas');
const elevCtx = elevCanvas.getContext('2d');

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
      const isSel  = selectedOpening === op;
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
    });
  
    drawDimLine(elevCtx, ox, oy + drawH + 22, ox + drawW, oy + drawH + 22, Math.round(wallLenMm) + 'mm', false);
    drawDimLine(elevCtx, ox - 46, oy, ox - 46, oy + drawH, Math.round(wallHMm) + 'mm', true);
  
    elevCanvas._drawInfo = info;
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
    elevDragOp      = null;
    elevHoveredOp   = null;
  
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
  }
  
  elevCanvas.addEventListener('mousemove', (e) => {
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { ox, scale, wallLenMm } = info;
  
    if (elevDragOp) {
      const rawMm   = (cx - ox) / scale - elevDragOffsetMm;
      const clamped = Math.max(0, Math.min(wallLenMm - elevDragOp.width, Math.round(rawMm / 50) * 50));
      elevDragOp.distFromLeft = clamped;
      syncElevEditorFields(elevDragOp);
      drawElevation();
      return;
    }
    const hit = openingHitTest(cx, cy, info);
    if (hit !== elevHoveredOp) {
      elevHoveredOp = hit;
      elevCanvas.style.cursor = hit ? 'grab' : 'default';
      drawElevation();
    }
  });
  
  elevCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
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
    if (elevDragOp) return;
    const info = elevCanvas._drawInfo;
    if (!info) return;
    const rect = elevCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = openingHitTest(cx, cy, info);
    selectedOpening = hit || null;
    if (selectedOpening) showElevOpeningEditor(selectedOpening);
    else document.getElementById('elev-opening-editor').style.display = 'none';
    drawElevation();
  });
  
  // ✅ FIX: Touch support for elevation canvas drag
  elevCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const synth = new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0, bubbles: true });
      elevCanvas.dispatchEvent(synth);
    }
  }, { passive: false });
  
  elevCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const synth = new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true });
      elevCanvas.dispatchEvent(synth);
    }
  }, { passive: false });
  
  elevCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const synth = new MouseEvent('mouseup', { bubbles: true });
    elevCanvas.dispatchEvent(synth);
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const synth2 = new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true });
      elevCanvas.dispatchEvent(synth2);
    }
  }, { passive: false });
  
  function syncElevEditorFields(op) {
    document.getElementById('elev-width').value      = Math.round(op.width);
    document.getElementById('elev-height').value     = Math.round(op.height);
    document.getElementById('elev-dist').value       = Math.round(op.distFromLeft);
    document.getElementById('elev-floor-dist').value = Math.round(op.floorDist);
  }
  
  function showElevOpeningEditor(op) {
    document.getElementById('elev-editor-title').textContent = op.type === 'door' ? 'Edit Door' : 'Edit Window';
    syncElevEditorFields(op);
    document.getElementById('elev-opening-editor').style.display = 'block';
  }
  
  document.getElementById('elev-apply').addEventListener('click', () => {
    if (!selectedOpening || !elevWall) return;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    selectedOpening.width        = Math.max(100, parseFloat(document.getElementById('elev-width').value)      || 100);
    selectedOpening.height       = Math.max(100, parseFloat(document.getElementById('elev-height').value)     || 100);
    selectedOpening.distFromLeft = Math.max(0, Math.min(wallLenMm - selectedOpening.width,
                                     parseFloat(document.getElementById('elev-dist').value) || 0));
    selectedOpening.floorDist    = Math.max(0, parseFloat(document.getElementById('elev-floor-dist').value)   || 0);
    syncElevEditorFields(selectedOpening);
    syncOpeningsTo3D(elevWall);
    drawElevation();
  });
  
  document.getElementById('elev-delete-opening').addEventListener('click', () => {
    if (!selectedOpening || !elevWall) return;
    elevOpenings      = elevOpenings.filter(o => o !== selectedOpening);
    elevWall.openings = elevOpenings;
    selectedOpening   = null;
    syncOpeningsTo3D(elevWall);
    document.getElementById('elev-opening-editor').style.display = 'none';
    drawElevation();
  });
  
  document.getElementById('elev-editor-cancel').addEventListener('click', () => {
    document.getElementById('elev-opening-editor').style.display = 'none';
    selectedOpening = null;
    drawElevation();
  });
  
  document.getElementById('elev-center-opening').addEventListener('click', () => {
    if (!selectedOpening || !elevWall) return;
    const wallLenMm = elevWall.start.distanceTo(elevWall.end) * 1000;
    selectedOpening.distFromLeft = Math.round((wallLenMm - selectedOpening.width) / 2 / 50) * 50;
    syncElevEditorFields(selectedOpening);
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
    selectedOpening = op;
    showElevOpeningEditor(op);
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
    selectedOpening = op;
    showElevOpeningEditor(op);
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
      const iy = mm(op.floorDist) + ih / 2;
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
  }
  
  function resizeLockedWall(wallObj, newLengthM) {
    const dir    = new THREE.Vector3().subVectors(wallObj.end, wallObj.start).normalize();
    const newEnd = wallObj.start.clone().addScaledVector(dir, newLengthM);
    if (!roomLocked) {
      const old = wallObj;
      scene.remove(old.mesh);
      if (old.capMeshes) old.capMeshes.forEach(c => scene.remove(c));
      if (old.label2D) wall2DLabelGroup.remove(old.label2D);
      walls = walls.filter(w => w !== old);
      const newWall = buildWall(wallObj.start, newEnd, true);
      pushHistory({ type: 'resize-wall', data: { removed: [old], restored: [newWall] } });
      rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
      updateRoomArea();
      return;
    }
    const idx = walls.indexOf(wallObj);
    if (idx === -1) return;
    const nextIdx  = (idx + 1) % walls.length;
    const nextWall = walls[nextIdx];
    const oldCurrent = wallObj, oldNext = nextWall;
    scene.remove(oldCurrent.mesh); scene.remove(oldNext.mesh);
    if (oldCurrent.capMeshes) oldCurrent.capMeshes.forEach(c => scene.remove(c));
    if (oldNext.capMeshes)    oldNext.capMeshes.forEach(c => scene.remove(c));
    if (oldCurrent.label2D)   wall2DLabelGroup.remove(oldCurrent.label2D);
    if (oldNext.label2D)      wall2DLabelGroup.remove(oldNext.label2D);
    walls = walls.filter(w => w !== oldCurrent && w !== oldNext);
    const updatedWall = buildWall(wallObj.start, newEnd, true);
    const updatedNext = buildWall(newEnd, nextWall.end, true);
    pushHistory({ type: 'resize-wall', data: { removed: [oldCurrent, oldNext], restored: [updatedWall, updatedNext]
 } });
    rebuildAllCaps(); refreshAll2DLabels(); rebuild2DWallOverlays();
    updateRoomArea();
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

    dragTarget   = hit;
    dragStartPos = dragTarget.position.clone();
    selectedItem = dragTarget;
    controls.enabled = false;

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
        if (hoveredWall && hoveredWall !== selectedWall) hoveredWall.mesh.material.color.set(0xddd5c8);
        hoveredWall = hit;
        if (hoveredWall !== selectedWall) hoveredWall.mesh.material.color.set(0xf0e0c0);
      }
      canvas.style.cursor = 'pointer';
    } else {
      if (hoveredWall && hoveredWall !== selectedWall) hoveredWall.mesh.material.color.set(0xddd5c8);
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
  
    // Quick Draw: always force 90° from wallStart
    const _dx = Math.abs(s.x - wallStart.x);
    const _dz = Math.abs(s.z - wallStart.z);
    s = _dx >= _dz
      ? new THREE.Vector3(s.x, 0, wallStart.z)
      : new THREE.Vector3(wallStart.x, 0, s.z);
  
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
  
    // Close-room proximity check
    if (firstPoint && s.distanceTo(firstPoint) < 0.2) {
      s = firstPoint.clone();
      closeHint.style.display = 'block';
    } else {
      closeHint.style.display = 'none';
    }
  
    updatePreview(s);
  
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
          if (wallHits.length > 0) {
            showWallPopup(wallHits[0].object.userData.wallObj, e.clientX, e.clientY);
            return;
          }
          hideWallPopup();
          selectedItem = null;
        }
      });
      
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelWallDraw(); });
      
      function cancelWallDraw() {
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
        if (IS_TOUCH) {
          // Touch: show draw mode menu
          const inDrawMode = ['draw-wall','draw-preset','draw-freehand','draw-twopoint'].includes(mode);
          if (inDrawMode) {
            abortPreviewWalls();
          } else {
            hideWallPopup();
            showDrawModeMenu();
          }
        } else {
          // Desktop: original behaviour unchanged
          if (mode === 'draw-wall') {
            cancelWallDraw();
          } else {
            mode = 'draw-wall';
            canvas.style.cursor = 'crosshair';
            hideWallPopup();
            document.getElementById('btn-draw-wall').style.background = '#ff9500';
            document.getElementById('btn-draw-wall').style.color = '#fff';
          }
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
        document.getElementById('btn-toggle-view').textContent = is3D ? 'Switch to 2D' : 'Switch to 3D';
        update2DLabelVisibility();
        rebuild2DWallOverlays();
      });
      
      document.getElementById('btn-undo')?.addEventListener('click', applyUndo);
      document.getElementById('btn-redo')?.addEventListener('click', applyRedo);
      updateUndoRedoButtons();
      
      // ✅ FIX: room-area display element — add <div id="room-area"> to your index.html
      // e.g. inside your toolbar: <div id="room-area" style="color:#aaa;font-size:12px;padding:4px 8px;"></div>
      
      const products = [
        { id:'base-600', name:'Base Cabinet 600mm', modelPath:'models/base-600.glb', width:600, height:900, depth:600,
          skus:[{id:'BC600-WHT',label:'White',price:450},{id:'BC600-OAK',label:'Oak',price:520}] },
        { id:'base-900', name:'Base Cabinet 900mm', modelPath:'models/base-900.glb', width:900, height:900, depth:600,
          skus:[{id:'BC900-WHT',label:'White',price:590},{id:'BC900-OAK',label:'Oak',price:660}] },
        { id:'wall-600', name:'Wall Cabinet 600mm', modelPath:'models/wall-600.glb', width:600, height:720, depth:350,
          skus:[{id:'WC600-WHT',label:'White',price:380},{id:'WC600-OAK',label:'Oak',price:430}] },
      ];
      
      const productList = document.getElementById('product-list');
      products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.textContent = product.name;
        div.addEventListener('click', () => placeProduct(product));
        productList.appendChild(div);
      });
      
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
        renderer.render(scene, activeCamera);
      }
      // ── GLB Import — button + drag-and-drop ──────────────────────────────────────

const glbFileInput = document.getElementById('glb-file-input');
const btnImportGlb = document.getElementById('btn-import-glb');

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
btnImportGlb.addEventListener('click', () => glbFileInput.click());
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
animate();  // ← this was already here, keep it as the last line
// ─── iPad Touch Controls ──────────────────────────────────────────────────────
const IS_TOUCH = navigator.maxTouchPoints > 0;
const isTouchDevice = () => IS_TOUCH; // keep for backwards compat


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
  let minDist = Infinity;

  walls.forEach(wall => {
    if (!wall.mesh) return;
    const box    = new THREE.Box3().setFromObject(wall.mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const toModel  = new THREE.Vector3().subVectors(pos, center);
    const wallDir  = new THREE.Vector3(0, 0, 1)
                       .applyQuaternion(wall.mesh.quaternion);
    const dist     = Math.abs(toModel.dot(wallDir));
    const wallSize = new THREE.Vector3();
    box.getSize(wallSize);
    const halfThick  = Math.min(wallSize.x, wallSize.z) / 2;
    const insideDist = Math.max(0, dist - halfThick);
    if (insideDist < minDist) minDist = insideDist;
  });

  const mm = Math.round(minDist * 1000);
  return `Distance to nearest wall: ${mm}mm`;
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
  if (!isTouchDevice()) return;
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
  drawModeActive = 'freehand';
  mode = 'draw-freehand';
  freehandRawPoints = [];
  canvas.style.cursor = 'crosshair';
  controls.enabled = false;
  document.getElementById('btn-draw-wall').style.background = '#ff9500';
  document.getElementById('btn-draw-wall').style.color = '#fff';
  showConfirmBar('Tap corners · ✓ to snap and preview');
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
