# HANDOFF_AUDIT.md — Repo Tidy-Up Audit (Phase 1)

Read-only audit of `main.js`, `auth.js`, `index.html`, `style.css` ahead of MVP launch.
**Nothing has been deleted or changed.** This is a findings list only — flag which items
to action and I'll do them in a follow-up.

Scope notes:
- `main.js` is 9578 lines. Function-length analysis used real body boundaries (verified by
  reading), not declaration gaps, since the file is densely interleaved with inline
  `addEventListener` handlers.
- Dead-CSS detection in `style.css` (1723 lines) is best-effort by hand; a full sweep wants
  a tool like PurgeCSS. High-confidence items only are listed.

---

## 1. Dead code & unused imports (LIST ONLY — not deleted)

### `auth.js`
- **`updateProject()` — lines 136–149.** Exported but **never imported or called** anywhere
  in `main.js` (import list at `main.js:4` omits it; only `saveProject` is used at
  `main.js:8947`). The Save flow always **inserts** a new row, so "Save Project" creates a
  duplicate row each time rather than updating an existing project. `updateProject` was
  clearly written to wire this and was never connected. **Dead export + latent feature gap.**
  Recommend: confirm intended save-vs-update behaviour with Opus before deleting — this may
  be a wiring bug, not dead code.

### `main.js`
- **`window._debug = { serialiseScene, clearScene, loadScene };` — line 7627.** Debug hook
  exposing internals on `window`. Not dead (it works) but is a debug-only affordance; decide
  whether it ships.
- **`// REPLACE WITH:` — line 1072** and **line 7610.** Leftover editing-artifact comments
  (no replacement followed; the surrounding code is the final version). Safe to remove.
- **`// redeploy trigger` — line 7366.** Leftover deploy-nudge comment. Safe to remove.

### `index.html`
- No dead element IDs found. Every element ID I sampled (`btn-fd-ruler`, `fd-ruler-bar`,
  `btn-joystick`, `wp-peek-btn`, `wp-more-btn`, `tmenu-*`, `dpp-back`, `readonly-badge`,
  `drawer-backdrop`, `btn-products-toggle`, etc.) is referenced in `main.js`. The
  **element-ID contract is intact** (per AGENTS.md, IDs are the binding contract).

### `style.css`
- No high-confidence dead rules identified by hand. All `/* ── … ── */` lines are section
  headers, not commented-out code. A definitive dead-selector list needs PurgeCSS run
  against `index.html` + the DOM that `main.js` builds at runtime (much of the UI — wall
  popup, elevation panel, desktop item panel, joystick — is injected from JS, so naive
  static analysis would produce false positives). **Recommend tooling before any deletion.**

### Unused imports
- `main.js:1–6` — all imports used: `THREE` (everywhere), `OrbitControls` (`77`, `4789`,
  `5048`), `GLTFLoader` (`984`), `jsPDF` (`5278`), `autoTable` (`5334`), and all 11 named
  `auth.js` imports are called. **No unused imports.**

---

## 2. TODO / FIXME / XXX / HACK comments

**None found** in `main.js`, `auth.js`, `index.html`, or `style.css`. The codebase uses
`// ✅ FIX:` markers (per AGENTS.md house style) instead — those denote completed fixes, not
outstanding work, so they are not flagged here.

---

## 3. Console statements that look like debug leftovers

Only **one** plain debug log; everything else is intentional (tagged analytics / load
tracing) or legitimate error handling.

| File:line | Statement | Verdict |
|---|---|---|
| `main.js:4465` | `console.log('Loaded', products.length, 'products from Shopify');` | **Likely debug leftover** — untagged, informational only. Low risk to remove. |

Intentional / keep (NOT leftovers):
- `main.js:37` — `console.log('[analytics]', name, props)` (the `[analytics]` hook).
- `main.js:7508`, `7552` — `[loadScene]` warnings (scene-version + missing-product tracing).
- `auth.js:93`, `98` — `[auth]` thumbnail-upload warnings.
- Error handlers (legitimate): `main.js:1051` (GLTF load), `4468` (Shopify load),
  `4650` (GLB import), `5228` (cartCreate), `5317` (PDF snapshot), `5405` (snapshot capture);
  `auth.js:30`, `36` (sign-in/out errors).

---

## 4. Hardcoded values that should be config

### Secrets / endpoints (public-safe per AGENTS.md, but config candidates)
| File:line | Value | Note |
|---|---|---|
| `auth.js:4` | `SUPABASE_URL = 'https://dswnkbokytqqjxpziyql.supabase.co'` | Public-safe **only if RLS stays enabled** (AGENTS.md §Security). Candidate for build-time env var. |
| `auth.js:5` | `SUPABASE_ANON_KEY = 'eyJ…'` | Same — anon key is public-safe with RLS. |
| `main.js:4312` | `SHOPIFY_DOMAIN = '3gxvcz-k1.myshopify.com'` | Storefront domain. Public-safe; config candidate. |
| `main.js:4313` | `SHOPIFY_API_VERSION = '2025-01'` | **Needs periodic bump** as Shopify deprecates versions — good config/env candidate. |
| `main.js:4314` | `SHOPIFY_STOREFRONT_TOKEN = '8f60ecff…'` | Storefront access token; public-safe by design (AGENTS.md). |

> These are **intentional** (the architecture says embed the Storefront token and Supabase
> anon key in the frontend). Extracting to a `.env`/build config is a hygiene improvement,
> not a security fix — do not treat as a leak.

### Magic numbers — all appear to be **intentional tuning values** (each is named + commented)
| File:line | Constant | Purpose |
|---|---|---|
| `main.js:39` | `SLAB_H = mm(300)` | Floor slab height — cabinets/walls sit on this. Structural. |
| `main.js:279` | `MAX_HISTORY = 20` | Undo/redo cap. Tuning. |
| `main.js:481` | `XRAY_OPACITY = 0.22` | Forced opacity while X-ray on. Tuning. |
| `main.js:500` | `TM_IDLE_MS = 2000` | Touch dock idle-fade delay. Tuning. |
| `main.js:5724` | `LONG_PRESS_MS = 450` | Long-press select threshold. Tuning. |
| `main.js:5725` | `LONG_PRESS_SLOP_PX = 10` | Long-press movement cancel slop. Tuning. |
| `main.js:6915` | `GLIDE_CLOSE_THRESH = mm(400)` | Glide-draw room-close snap distance. Tuning. |
| `main.js:6924` | `LOUPE_SIZE = 140` | Glide loupe diameter (CSS px). Tuning. |
| `main.js:6925` | `LOUPE_ZOOM = 2.5` | Glide loupe magnification. Tuning. |
| `main.js:7752` | `CAB3D_DIM_MAX_GAP = 10` | Skip cabinet dims longer than 10 m. Tuning. |
| `main.js:8677` | `JOY_SPEED = 240` | Joystick cursor px/sec at full deflection. Tuning. |

**Verdict:** No accidental magic numbers found — they are all hoisted, named, and commented.
The Shopify API version (`2025-01`) is the one most worth moving to config, since it must be
bumped on a schedule independent of code logic.

---

## 5. Functions over 100 lines in `main.js` (information only — DO NOT refactor)

Per ARCHITECTURE.md §9, `main.js` single-file size is acknowledged tech debt. Verified body
lengths (read, not gap-estimated):

| Function | Lines | ~Length | Purpose (one sentence) |
|---|---|---|---|
| `drawElevation()` | 2223–2526 | ~303 | Renders the 2D wall-elevation canvas — grid, slab hatch, openings, cabinets, ruler ticks, and the 7-line green dimension chain for the current selection. |
| `ensureJoystickUI()` | 8688–8815 | ~127 | Builds the on-screen joystick overlay (base/nub, L/R/exit buttons, hints) and wires its pointer input for touch wall-drawing. |
| `showWallPopup()` | 1370–1494 | ~124 | Positions and populates the Edit-Wall popup across desktop / bottom-sheet / Quick-Draw variants, wires the anchor row, highlights the wall, shows the dim label. |
| `initTouchModifierDock()` | 9376–9495 | ~119 | Builds and wires the touch modifier dock — shift latch, cam-lock, collapse/restore, vertical drag, and localStorage persistence. |
| `loadScene()` | 7506–7624 | ~118 | Deserialises `scene_json` (versions 1/2/3 with migrations) and rebuilds walls, openings, items, floor slab, and camera. |
| `buildCabDim3D()` | 7838–7944 | ~106 | Builds the 3D dimension lines + labels for a selected cabinet (raycasts to walls for side gaps, plus floor and ceiling gaps). |

Note: several **inline event-handler blocks** (not named functions) also exceed 100 lines —
e.g. the `canvas` `mousemove`/`mousedown` draw handlers around `main.js:3461–3700` and the
product-drop handler block around `4146–4310`. These are not "functions" per se but are the
other large chunks if a future refactor targets them.

---

## 6. External dependencies — declared vs. actually used

From `package.json`:

| Dependency | Declared | Used? | Evidence |
|---|---|---|---|
| `@supabase/supabase-js` `^2.107.0` | ✓ | ✓ | `auth.js:2` `createClient` |
| `jspdf` `^4.2.1` | ✓ | ✓ | `main.js:5278` `new jsPDF(...)` |
| `jspdf-autotable` `^5.0.8` | ✓ | ✓ | `main.js:5334` `autoTable(doc, …)` |
| `three` `^0.184.0` | ✓ | ✓ | `main.js:1–3` + throughout |
| `vite` `^8.0.14` (dev) | ✓ | ✓ | build/dev tooling (`npm run dev/build/preview`) |

**No unused dependencies.** All five are exercised.

> Side note (not a dependency issue): `eruda` is loaded via CDN in `index.html:9–10`, gated
> behind `?debug=1`. Intentional on-device console per AGENTS.md — not in `package.json` by
> design.

---

## Suggested action shortlist (for your call)
1. **Decide save-vs-update behaviour** — `auth.js:updateProject` is dead *because* the Save
   flow only inserts. Likely a real wiring gap worth fixing (duplicate project rows today).
   *(Touches save flow → may warrant an Opus check.)*
2. Remove the three leftover comments (`main.js:1072`, `7366`, `7610`) and decide on
   `window._debug` (`7627`). Trivial, no behaviour change.
3. Remove/keep the untagged `console.log` at `main.js:4465`. Trivial.
4. (Optional hygiene) Move `SHOPIFY_API_VERSION` to config so version bumps don't touch code.
5. Long functions + `main.js` size: **leave as-is** unless explicitly scheduled — tech debt
   acknowledged in ARCHITECTURE.md §9.
