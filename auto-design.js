// ── auto-design.js ───────────────────────────────────────────────────────────
// Pure solver module — no Three.js, no DOM, no main.js imports.
// All vector outputs are plain { x, y, z } objects (JSON-serialisable).
// Entry point: runAutoDesign(spec, products) → { walls, cabinets, warnings }

import {
  NZ_BUILDING_RULES,
  BASE_HEIGHT_MM, BASE_DEPTH_MM,
  BASE_WIDTHS, FILLER_MAX_MM, CORNER_RESERVE_MM,
  buildArchetypeWalls, gapFill, findCornerJunctions,
  findBaseProduct, findCornerProduct, isCornerProduct
} from './auto-design-rules.js';

// ── hashSpec ──────────────────────────────────────────────────────────────────
// djb2 hash of JSON.stringify(spec), returned as 6-char lowercase hex.
export function hashSpec(spec) {
  const str = JSON.stringify(spec);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;  // keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0').slice(-6);
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function wallLengthM(wall) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function wallDirUnit(wall) {
  const len = wallLengthM(wall);
  if (len < 1e-6) return { x: 1, z: 0 };
  return { x: (wall.end.x - wall.start.x) / len, z: (wall.end.z - wall.start.z) / len };
}

// Cabinet's facing rotation (radians) given the wall's inward normal.
// Three.js: rotationY=0 faces +Z; atan2(nx, nz) gives the correct angle.
function rotationFromNormal(n) {
  return Math.atan2(n.x, n.z);
}

// ── Opening overlap checker ───────────────────────────────────────────────────
function checkOpeningOverlaps(openings, wallIndex, warnings) {
  const sorted = [...openings].sort((a, b) => a.positionMm - b.positionMm);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.positionMm + a.widthMm > b.positionMm) {
        warnings.push({
          severity: 'warn',
          message:  `Opening overlap on wall ${wallIndex}: ${a.type} at ${a.positionMm}mm overlaps ${b.type} at ${b.positionMm}mm`,
          wallIndex
        });
      }
    }
  }
}

// ── NZBC rule checker for hob ─────────────────────────────────────────────────
function checkHobNZBC(hobStartMm, hobWidthMm, windows, wallIndex, warnings) {
  const pendingSuffix = NZ_BUILDING_RULES._meta.lastReviewed == null
    ? ' — values pending installer review' : '';

  for (const win of windows) {
    const hobEnd  = hobStartMm + hobWidthMm;
    const winEnd  = win.positionMm + win.widthMm;
    // Minimum gap between hob zone and window zone
    const gap = Math.max(0,
      Math.max(hobStartMm - winEnd, win.positionMm - hobEnd)
    );
    if (gap < NZ_BUILDING_RULES.hob_window_min_distance_mm) {
      warnings.push({
        severity: 'warn',
        message:  `Hob within ${NZ_BUILDING_RULES.hob_window_min_distance_mm}mm of window (NZBC G4)${pendingSuffix}`,
        wallIndex,
        ruleId:   'hob_window_min_distance_mm'
      });
      break;
    }
  }
}

// ── Cabinet sequence solver for one wall ─────────────────────────────────────
// reservedStartMm / reservedEndMm = mm already claimed by corner cabinets.
function solveCabinetsForWall(wallGeom, assignment, wallIndex, products, warnings, opts = {}) {
  const { reservedStartMm = 0, reservedEndMm = 0 } = opts;
  const wallLenMm   = Math.round(wallLengthM(wallGeom) * 1000);
  const dir         = wallDirUnit(wallGeom);
  const norm        = wallGeom.inwardNormal;
  const rotY        = rotationFromNormal(norm);
  const depthM      = BASE_DEPTH_MM / 1000;
  const appliances  = assignment?.appliances || [];
  const openings    = assignment?.openings   || [];

  // Check for overlapping openings (test 12)
  checkOpeningOverlaps(openings, wallIndex, warnings);

  // Effective usable range on this wall
  const usableStart = reservedStartMm;
  const usableEnd   = wallLenMm - reservedEndMm;
  if (usableEnd <= usableStart) return [];

  // Windows sorted by position — for sink placement
  const windows = [...openings]
    .filter(o => o.type === 'window')
    .sort((a, b) => a.positionMm - b.positionMm);

  // ── Anchor: sink ─────────────────────────────────────────────────────────
  const SINK_WIDTH = 600;
  let sinkStartMm  = null;
  let sinkWindow   = null;

  if (appliances.includes('sink')) {
    // Prefer the first window with sill < 900mm (test 11), then any window
    sinkWindow = windows.find(w => (w.sillMm ?? 0) < 900) ?? windows[0] ?? null;

    if (sinkWindow) {
      // Centre the sink cabinet on the window
      const winCentre = sinkWindow.positionMm + sinkWindow.widthMm / 2;
      sinkStartMm = Math.round(winCentre - SINK_WIDTH / 2);
    } else {
      // Centre of usable run
      sinkStartMm = Math.round((usableStart + usableEnd) / 2 - SINK_WIDTH / 2);
    }
    sinkStartMm = Math.max(usableStart, Math.min(sinkStartMm, usableEnd - SINK_WIDTH));
  }

  // ── Anchor: dishwasher ────────────────────────────────────────────────────
  const DW_WIDTH  = 600;
  let dwStartMm   = null;

  if (appliances.includes('dishwasher') && sinkStartMm !== null) {
    // Prefer left of sink; fall back to right
    const leftStart  = sinkStartMm - DW_WIDTH;
    const rightStart = sinkStartMm + SINK_WIDTH;
    if (leftStart >= usableStart) {
      dwStartMm = leftStart;
    } else if (rightStart + DW_WIDTH <= usableEnd) {
      dwStartMm = rightStart;
    } else {
      warnings.push({
        severity: 'info',
        message:  `Dishwasher could not be placed adjacent to sink on wall ${wallIndex}`,
        wallIndex
      });
    }
  }

  // ── Anchor: hob ──────────────────────────────────────────────────────────
  const HOB_WIDTH = 600;
  let hobStartMm  = null;

  if (appliances.includes('hob')) {
    // Place hob on the opposite side of the run from the sink cluster
    const sinkClusterEnd = sinkStartMm !== null
      ? Math.max(
          sinkStartMm + SINK_WIDTH,
          dwStartMm !== null ? dwStartMm + DW_WIDTH : 0
        )
      : usableStart;

    if (sinkClusterEnd <= usableEnd / 2) {
      // Sink at left half → hob at right
      hobStartMm = usableEnd - HOB_WIDTH;
    } else {
      // Sink at right half → hob at left
      hobStartMm = usableStart;
    }
    hobStartMm = Math.max(usableStart, Math.min(hobStartMm, usableEnd - HOB_WIDTH));

    // NZBC check
    checkHobNZBC(hobStartMm, HOB_WIDTH, windows, wallIndex, warnings);
  }

  // ── Anchor: fridge ────────────────────────────────────────────────────────
  const FRIDGE_WIDTH = 600;
  let fridgeStartMm  = null;

  if (appliances.includes('fridge') || assignment?.hasFridge) {
    // Put fridge at the end furthest from the hob
    if (hobStartMm !== null && hobStartMm + HOB_WIDTH > usableEnd / 2) {
      fridgeStartMm = usableStart;  // hob at right → fridge at left
    } else {
      fridgeStartMm = usableEnd - FRIDGE_WIDTH;  // hob at left or absent → fridge at right
    }
  }

  // ── Build named slots ─────────────────────────────────────────────────────
  const namedSlots = []; // { startMm, widthMm, role }

  const addSlot = (startMm, widthMm, role) => {
    if (startMm === null || startMm === undefined) return;
    // Skip if it falls outside usable range
    if (startMm < usableStart || startMm + widthMm > usableEnd) return;
    // Skip if overlaps an existing slot
    if (namedSlots.some(s => startMm < s.startMm + s.widthMm && startMm + widthMm > s.startMm)) return;
    namedSlots.push({ startMm, widthMm, role });
  };

  // Fridge first (fixes one end before sink cluster)
  addSlot(fridgeStartMm, FRIDGE_WIDTH, 'fridge');
  addSlot(dwStartMm,     DW_WIDTH,     'dishwasher');
  addSlot(sinkStartMm,   SINK_WIDTH,   'sink');
  addSlot(hobStartMm,    HOB_WIDTH,    'hob');

  namedSlots.sort((a, b) => a.startMm - b.startMm);

  // ── Gap-fill between named slots ──────────────────────────────────────────
  const allSlots = [];
  let cursor = usableStart;

  for (const slot of namedSlots) {
    if (cursor < slot.startMm) {
      const fills = gapFill(slot.startMm - cursor);
      let fc = cursor;
      for (const fw of fills) {
        allSlots.push({ startMm: fc, widthMm: fw, role: 'drawers' });
        fc += fw;
      }
    }
    allSlots.push(slot);
    cursor = slot.startMm + slot.widthMm;
  }
  // Tail gap
  if (cursor < usableEnd) {
    const fills = gapFill(usableEnd - cursor);
    let fc = cursor;
    for (const fw of fills) {
      allSlots.push({ startMm: fc, widthMm: fw, role: 'drawers' });
      fc += fw;
    }
  }

  // ── Convert slots → cabinet entries ──────────────────────────────────────
  const cabinets = [];
  for (const slot of allSlots) {
    const product = findBaseProduct(products, slot.widthMm);
    if (!product) continue;  // no matching SKU — adapter logs a skip warning

    // Cabinet centre position in world space
    const tM = (slot.startMm + slot.widthMm / 2) / 1000;  // along-wall metres
    cabinets.push({
      productHandle: product.id,
      position: {
        x: wallGeom.start.x + dir.x * tM + norm.x * (depthM / 2),
        y: 0,  // floor-seated; placeProductAt uses h/2 when y===0
        z: wallGeom.start.z + dir.z * tM + norm.z * (depthM / 2)
      },
      rotationY:   rotY,
      wallIndex,
      kitchenRole: slot.role
    });
  }

  return cabinets;
}

// ── runAutoDesign ─────────────────────────────────────────────────────────────
// spec: { archetype, widthMm, depthMm, wallAssignments[] }
// products: array of product objects (Shopify shape)
// Returns: { walls, cabinets, warnings }   — all values are plain JSON
export function runAutoDesign(spec, products) {
  const warnings = [];

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!spec?.wallAssignments || spec.wallAssignments.length === 0) {
    return {
      walls:    [],
      cabinets: [],
      warnings: [{ severity: 'error', message: 'No walls assigned to kitchen layout', wallIndex: null }]
    };
  }

  // ── Generate archetype walls ───────────────────────────────────────────────
  const walls = buildArchetypeWalls(
    spec.archetype || 'I',
    spec.widthMm   || 3000,
    spec.depthMm   || 1200
  );

  if (walls.length === 0 && spec.archetype !== 'custom') {
    warnings.push({ severity: 'warn', message: `Unknown archetype: ${spec.archetype}`, wallIndex: null });
    return { walls, cabinets: [], warnings };
  }

  // ── Detect corner junctions and compute reserved zones per wall ────────────
  const corners      = findCornerJunctions(walls);
  const reservations = {};  // wallIndex → { startMm, endMm }

  for (const corner of corners) {
    const { wallIndexA, wallAEnd, wallIndexB, wallBEnd } = corner;
    if (!reservations[wallIndexA]) reservations[wallIndexA] = { startMm: 0, endMm: 0 };
    if (!reservations[wallIndexB]) reservations[wallIndexB] = { startMm: 0, endMm: 0 };
    if (!wallAEnd) reservations[wallIndexA].startMm = CORNER_RESERVE_MM;
    else           reservations[wallIndexA].endMm   = CORNER_RESERVE_MM;
    if (!wallBEnd) reservations[wallIndexB].startMm = CORNER_RESERVE_MM;
    else           reservations[wallIndexB].endMm   = CORNER_RESERVE_MM;
  }

  // ── Solve cabinets for each assigned wall ──────────────────────────────────
  const cabinets = [];

  for (const assignment of spec.wallAssignments) {
    const wi       = assignment.wallIndex;
    const wallGeom = walls[wi];
    if (!wallGeom) {
      warnings.push({ severity: 'warn', message: `Wall index ${wi} not found in archetype`, wallIndex: wi });
      continue;
    }
    const res = reservations[wi] || { startMm: 0, endMm: 0 };
    const wallCabs = solveCabinetsForWall(
      wallGeom, assignment, wi, products, warnings,
      { reservedStartMm: res.startMm, reservedEndMm: res.endMm }
    );
    cabinets.push(...wallCabs);
  }

  // ── Place corner cabinets at each junction ─────────────────────────────────
  for (const corner of corners) {
    const product = findCornerProduct(products, warnings, corner.wallIndexA);
    if (!product) continue;

    const wallA = walls[corner.wallIndexA];
    const wallB = walls[corner.wallIndexB];
    const dirA  = wallDirUnit(wallA);
    const dirB  = wallDirUnit(wallB);

    // Determine direction along each wall from the corner point
    const fromCornerA = corner.wallAEnd
      ? { x: -dirA.x, z: -dirA.z }
      : { x:  dirA.x, z:  dirA.z };
    const fromCornerB = corner.wallBEnd
      ? { x: -dirB.x, z: -dirB.z }
      : { x:  dirB.x, z:  dirB.z };

    // Corner cabinet centre: half the corner reserve inward along each wall from corner
    const halfR = CORNER_RESERVE_MM / 2 / 1000;
    cabinets.push({
      productHandle: product.id,
      position: {
        x: corner.point.x + fromCornerA.x * halfR + fromCornerB.x * halfR,
        y: 0,
        z: corner.point.z + fromCornerA.z * halfR + fromCornerB.z * halfR
      },
      // Face diagonally: average of the two wall normals
      rotationY: rotationFromNormal({
        x: (wallA.inwardNormal.x + wallB.inwardNormal.x) / 2,
        z: (wallA.inwardNormal.z + wallB.inwardNormal.z) / 2
      }),
      wallIndex:   corner.wallIndexA,
      kitchenRole: 'corner'
    });
  }

  return { walls, cabinets, warnings };
}
