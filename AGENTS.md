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

- `main.js` — the full planner (**~4700 lines, working**): walls, GLB import, elevation
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

## Cursor Cloud specific instructions

Single-service frontend — no Docker, local DB, or `.env` files. Startup dependency refresh is `npm install` only (see `.cursor/environment.json`).

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server on **http://localhost:5173** (`vite --host`) |
| `npm run build` | Production bundle to `dist/` |
| `npm run preview` | Serve the production build locally |

**Lint / tests:** none configured (`package.json` has no `lint` or `test` scripts). Verify changes by running `npm run dev` and exercising the UI (walls, catalog, 2D/3D toggle, quote panel).

**External services (outbound HTTPS required):**
- **Shopify Storefront API** — product catalog on load (`main.js`). Without network, the sidebar shows an error and no products load.
- **Supabase** — auth + project save/load (`auth.js`). Client initialises without login; Google sign-in needs `http://localhost:5173` in Supabase allowed redirect URLs.
- **GLB URLs** from Shopify metafields — 3D models; missing URLs fall back to box placeholders.

**Dev server:** run `npm run dev` in a tmux session (e.g. `vite-dev-server`) so it stays alive across agent turns. The planner works unsigned-in for core layout work; auth/save flows need a Google account via Supabase OAuth.
