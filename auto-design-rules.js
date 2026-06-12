// ── auto-design-rules.js ─────────────────────────────────────────────────────
// Pure data + helpers — no Three.js, no DOM, no main.js imports.
// All values are plain JSON-serialisable objects.

// ── NZ Building Rules ─────────────────────────────────────────────────────────
export const NZ_BUILDING_RULES = {
  hob_clearance_above_mm:        600,
  hob_clearance_side_mm:          50,
  hob_combustible_distance_mm:   200,
  sink_waste_max_horizontal_mm: 3000,
  worktop_height_range_mm:      [850, 950],
  dishwasher_plumbing_radius_mm: 1500,
  range_hood_min_duct_mm:        150,
  hob_window_min_distance_mm:    300,
  _meta: {
    sources:     ['AS/NZS 5601.1', 'NZBC G4', 'NZBC G12'],
    lastReviewed: null,
    reviewedBy:   null,
    disclaimer:   'Guidance only. Confirm with a licensed installer and your local council before purchase or installation.'
  }
};

// ── Cabinet dimensions ────────────────────────────────────────────────────────
export const BASE_HEIGHT_MM  = 720;
export const BASE_DEPTH_MM   = 580;
export const WALL_HEIGHT_MM  = 350;
export const WALL_DEPTH_MM   = 300;
export const WALL_MOUNT_HEIGHT_MM = 1400;  // bottom of wall cabinet from floor

// ── Standard widths (mm, descending for gap-fill) ────────────────────────────
export const BASE_WIDTHS        = [900, 800, 600, 500, 400, 300, 200];
export const WALL_CABINET_WIDTHS = [900, 800, 600, 500, 400, 300];

// Gaps smaller than this are filled with a filler panel (no cabinet product)
export const FILLER_MAX_MM = 150;

// Space reserved on each wall at a corner junction
export const CORNER_RESERVE_MM = 900;

// ── Archetype wall geometry ───────────────────────────────────────────────────
// Returns array of { start:{x,y,z}, end:{x,y,z}, inwardNormal:{x,z} } in metres.
// Room interior is always in the +X / +Z quadrant for all archetypes.
// inwardNormal is the 2D (XZ-plane) unit vector pointing INTO the kitchen from the wall.
export function buildArchetypeWalls(archetype, widthMm, depthMm) {
  const w = widthMm / 1000;
  const d = (depthMm || 1200) / 1000;

  switch (archetype) {
    case 'I':
      return [
        { start: { x: 0, y: 0, z: 0 }, end: { x: w, y: 0, z: 0 }, inwardNormal: { x: 0, z: 1 } }
      ];

    case 'II':
      // Two parallel walls; room is the corridor between them (width gap = depthMm)
      return [
        { start: { x: 0, y: 0, z: 0 }, end: { x: w, y: 0, z: 0 }, inwardNormal: { x: 0,  z:  1 } },
        { start: { x: 0, y: 0, z: d }, end: { x: w, y: 0, z: d }, inwardNormal: { x: 0,  z: -1 } }
      ];

    case 'L':
      // Back wall (along X) + left return wall (along Z); corner at origin
      return [
        { start: { x: 0, y: 0, z: 0 }, end: { x: w, y: 0, z: 0 }, inwardNormal: { x: 0,  z: 1 } },
        { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: d }, inwardNormal: { x: 1,  z: 0 } }
      ];

    case 'C':
      // U-shape: back wall + two side walls; corners at (0,0,0) and (w,0,0)
      return [
        { start: { x: 0, y: 0, z: 0 }, end: { x: w, y: 0, z: 0 }, inwardNormal: { x:  0,  z: 1 } },
        { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: d }, inwardNormal: { x:  1,  z: 0 } },
        { start: { x: w, y: 0, z: 0 }, end: { x: w, y: 0, z: d }, inwardNormal: { x: -1,  z: 0 } }
      ];

    case 'G': {
      // C-shape + peninsula; corners at (0,0,0) and (w,0,0)
      const penX    = Math.round(w * 0.35 * 1000) / 1000;
      const penLen  = Math.round(d * 0.55 * 1000) / 1000;
      return [
        { start: { x: 0,    y: 0, z: 0 }, end: { x: w,    y: 0, z: 0 }, inwardNormal: { x:  0, z:  1 } },
        { start: { x: 0,    y: 0, z: 0 }, end: { x: 0,    y: 0, z: d }, inwardNormal: { x:  1, z:  0 } },
        { start: { x: w,    y: 0, z: 0 }, end: { x: w,    y: 0, z: d }, inwardNormal: { x: -1, z:  0 } },
        { start: { x: penX, y: 0, z: d }, end: { x: penX, y: 0, z: d - penLen }, inwardNormal: { x: 1, z: 0 } }
      ];
    }

    default:
      return [];
  }
}

// ── Gap-fill ladder ───────────────────────────────────────────────────────────
// Given a gap in mm, returns an array of cabinet widths (mm) that fill it best.
// Greedy descending. Remainder < FILLER_MAX_MM is a filler panel (no product).
export function gapFill(gapMm, availableWidths = BASE_WIDTHS) {
  if (gapMm <= 0) return [];
  if (gapMm < FILLER_MAX_MM) return [];

  const sorted  = [...availableWidths].sort((a, b) => b - a);
  const minW    = Math.min(...sorted);
  const result  = [];
  let remaining = gapMm;

  while (remaining >= minW) {
    const fit = sorted.find(w => w <= remaining);
    if (!fit) break;
    result.push(fit);
    remaining -= fit;
    if (remaining < FILLER_MAX_MM) break;
  }
  return result;
}

// ── Corner junction detection ─────────────────────────────────────────────────
// Returns array of { point:{x,z}, wallIndexA, wallAEnd, wallIndexB, wallBEnd }
// where wallAEnd/wallBEnd = true if the corner is at that wall's end point (vs start).
export function findCornerJunctions(walls) {
  const EPS = 0.002; // 2mm tolerance
  const corners = [];

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wa = walls[i];
      const wb = walls[j];
      const ptA = [wa.start, wa.end];
      const ptB = [wb.start, wb.end];

      for (let ai = 0; ai < 2; ai++) {
        for (let bi = 0; bi < 2; bi++) {
          const pa = ptA[ai];
          const pb = ptB[bi];
          const dist = Math.sqrt((pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2);
          if (dist < EPS) {
            corners.push({
              point:      { x: pa.x, z: pa.z },
              wallIndexA: i,
              wallAEnd:   ai === 1,
              wallIndexB: j,
              wallBEnd:   bi === 1
            });
          }
        }
      }
    }
  }
  return corners;
}

// ── Product helpers ───────────────────────────────────────────────────────────
export function isCornerProduct(p) {
  const id = (p.id || '').toLowerCase();
  return p.category === 'base' && (id.includes('corner') || id.includes('crnr'));
}

// Find a base cabinet of exactly `widthMm`, non-corner.
// Returns the product object or null.
export function findBaseProduct(products, widthMm) {
  return products.find(p =>
    p.category === 'base' &&
    !isCornerProduct(p) &&
    p.width === widthMm
  ) || null;
}

// Find the preferred corner cabinet (900mm), with substitution fallback.
// Pushes a warning if substituting. Returns product or null.
export function findCornerProduct(products, warnings, wallIndex) {
  const preferred = products.find(p => isCornerProduct(p) && p.width === 900);
  if (preferred) return preferred;

  const allCorners = products.filter(isCornerProduct);
  if (allCorners.length === 0) return null;

  allCorners.sort((a, b) => Math.abs(a.width - 900) - Math.abs(b.width - 900));
  const sub = allCorners[0];
  warnings.push({
    severity: 'warn',
    message:  `Corner cabinet (900mm) not in catalogue; using ${sub.id} (${sub.width}mm)`,
    wallIndex
  });
  return sub;
}
