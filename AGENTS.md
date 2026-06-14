# Brown Box Kit — 3D Kitchen Planner (Agent Operating Manual)

You are helping ship a Shopify-integrated 3D kitchen planner for **Brown Box Kit**
(brownboxkit.co.nz). The architecture has already been designed by Opus — your job
is to **implement tasks cleanly without re-architecting**.

## Project context

- Brown Box Kit is a New Zealand flat-pack kitchen cabinet retailer on Shopify.
- Browser-based planner, built with **three.js + vanilla JS, no framework**.
- Supports desktop, iPad, iPhone, and Android.
- Catalog comes from the **Shopify Storefront API** (not hard-coded).
- Auth + project storage uses **Supabase** (free tier).
- Hosting is **Vercel**, deployed from **GitHub** (`brandonlee-ct/kitchen-planner-v3`, branch `main`).
- Pricing is **NZD**; customer is in NZ.

## Stack & commands

- **Vite** dev/build: `npm run dev` (local server), `npm run build`, `npm run preview`.
- **three.js** `^0.184` (`OrbitControls`, `GLTFLoader` from `three/addons`).
- **@supabase/supabase-js** `^2.107`.
- **eruda** on-screen console (CDN in `index.html`) for debugging on iPad/phone.
- No automated tests — verify by running `npm run dev` and exercising the UI.

## Files

- `main.js` — the full planner (**~9750 lines, working**): walls, GLB import, elevation
  view, undo/redo, touch + desktop input, quote totals, CSV export, Shopify fetch,
  Supabase wiring. Single file by design.
- `index.html` — toolbar, panels, modals, drawer. Most styling is inline here.
  **Element IDs are the contract** `main.js` binds to — don't rename across one side only.
- `auth.js` — Supabase client, auth UI, project CRUD (`saveProject`, `listProjects`,
  `loadProject`, `updateProject`, `deleteProject`).
- `style.css` — responsive layout; iPhone/iPad breakpoints already in place.
- `*.backup.*` — legacy manual backups, redundant now git holds history. Don't edit.

## Architecture decisions — DO NOT CHANGE WITHOUT ASKING

- Scene state lives in the `walls` and `placedItems` arrays (`main.js`). Serialise these
  as JSON (`scene_json`) to save projects.
- Shopify Storefront API access token is public-safe — embed in frontend.
- Product metafields live in the `planner.*` namespace: `glb_url`, `width_mm`,
  `height_mm`, `depth_mm`, `category`. (Confirmed in the Storefront query.)
- Save Project → Supabase `projects` table, `scene_json` jsonb column, keyed by `user_id`.
- Wall handles must be ~`0.22` radius on touch, `0.15` on mouse (see `SphereGeometry`, ~line 571).
- `IS_TOUCH` constant already exists in `main.js` — use it.
- **PLANNED (not yet in code):** "Send to Cart" via Shopify `cartCreate` mutation →
  redirect to `cart.checkoutUrl`. Treat as the agreed design when implementing; do not
  assume it already exists.

## House rules for this codebase

- **Do not refactor working code. Add to it.**
- Keep existing function names — other parts of the file depend on them.
- Touch and mouse paths must BOTH keep working. There are parallel `touchstart/touchmove`
  and `mousedown/mousemove` code paths. Mentally test iPhone, iPad, and desktop before declaring done.
- All measurements **internally in metres; user-facing in mm**. Use the `mm(v)` helper (mm → metres).
- **Never break undo/redo.** New mutating actions must `pushHistory({ type, data })` and be
  handled in `executeUndo`/`executeRedo`. Capped by `MAX_HISTORY`.
- three.js **dispose pattern is critical** for GLB: geometry, materials, and textures must
  all be disposed when models are swapped or removed. Follow existing `disposeModel()`.
- CSS: respect existing breakpoints (**430px iPhone, 768px tablet**). Don't add new ones without reason.
- Match existing style: `// ── Section ──` headers, `camelCase`, `// ✅ FIX:` markers.

## Security

- The Supabase **anon key in `auth.js` is public-safe** — but ONLY if **Row Level Security
  (RLS) is enabled** on `projects` with policies scoping rows to `auth.uid()`. The client-side
  `.eq('user_id', ...)` filters are belt-and-braces, not a substitute. Never disable RLS.
- Never commit real secrets (`.env*` is gitignored). Keep service-role keys out of client code.

## When you're unsure

- Ask before changing scene-state shape, history-entry shape, or any function signature.
- If a request seems to require a backend, say so — we're frontend-only except Supabase SDK calls.
- If a task feels like architecture (auth flow, schema, security, three.js math), tell me to
  take it to Opus first.

## Output style

- Lead with the code change. Brief explanation after.
- For multi-file changes, show each file's diff separately.
- No long preambles — I'll read the code.

## Git

- Commit-message style: short imperative, phase/bug prefixed —
  e.g. `Task F: save/load projects via Supabase`, `Bug 1: fix wall taps on touch`, `Checkpoint: ...`.
- Checkpoint (commit + push) before risky changes; that's the safety net.

## Branch & release discipline — MANDATORY

(Added after the June 2026 incident where a day of core work was stranded on
`feature/auto-design` and never deployed.)

- **Before your first commit, run `git branch --show-current` and confirm you are on the
  branch the task expects.** Core planner tasks belong on `main` (or a short-lived branch
  named for that task). NEVER commit core planner work onto an unrelated feature branch.
- The live site deploys from `main` only. **A task is not "done" until it is merged to
  `main`, pushed, and verified on planner.brownboxkit.co.nz** — not in a local preview.
- Merge or delete feature branches the same day the work is accepted. Don't leave
  unmerged branches or Cursor worktrees lying around.
- Never commit debug instrumentation (e.g. `fetch('http://127.0.0.1:...')` log calls).
  Strip it before committing.
- Wrap new top-level button wiring in a null-safe pattern (`const el =
  document.getElementById(...); if (el) el.addEventListener(...)`). A missing element must
  not throw and kill every handler wired after it.
- If `scene_json` shape changes, bump the version, keep a migration for older saves, and
  deploy the reader and writer together — never let a build that writes the new version
  coexist with a live build that can't read it.

## Post-task smoke checklist

After ANY task, verify these still work before declaring done (desktop + touch):
Save Project & Restart Planner in hamburger · long-press select on touch ·
cabinets sit on the 300mm slab (place, save, reload) · power point button in elevation ·
Quote CSV + PDF export · door/window select + drag along wall with dims ·
undo/redo · zoom speed normal with a cabinet selected.
