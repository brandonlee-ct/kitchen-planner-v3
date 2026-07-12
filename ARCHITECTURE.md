# Brown Box Kit Kitchen Planner — Architecture & Scope (as reviewed)

> Planning document. No application code is changed by this file.
> Tip: read this with Markdown Preview (`Ctrl+Shift+V`) for full-width formatting.

> **Revision (aligned with the simplified model in `FEASIBILITY.md`):** the wider business
> is a **single entity** with **all customer money via Shopify standard checkout** (no Stripe
> rail / credit / interest). Planner build state updated: **Send-to-Cart, thumbnails->Storage,
> and power points in elevation are done.** Shopify embed for P1 = **subdomain link** to
> `planner.brownboxkit.co.nz`; **App Proxy + the one-login JWT bridge move to Phase 2**
> (raw iframe rejected). Share links use **Option B** (a `security definer` RPC, no broad
> public-select policy). White-label SaaS is a far-future re-architecture, not planned work.

---

## 1. Product vision (one paragraph)

A browser-based 3D/2D kitchen planner for **Brown Box Kit** (NZ flat-pack cabinets),
embedded in their Shopify storefront. Customers draw their room, drop in real cabinet
GLB models pulled live from the Shopify catalog, see an itemised **NZD** quote update in
real time, and send the result to the Shopify cart / save it to their account. Must work
well on **desktop, iPad, iPhone (iOS), and Android**. Later: realistic renders,
first-person walkthrough, PDF construction docs, and eventually a white-label SaaS.

**Current status:** Phase 0 is **live and testable** at `planner.brownboxkit.co.nz`
(Shopify catalog + Google auth + Supabase save/load all working).

---

## 2. System architecture (current, as-built)

```
                 ┌─────────────────────────────────────────────┐
                 │                Browser (client)              │
                 │  index.html  +  main.js (~4700 lines)        │
                 │  three.js (3D/2D)   ·   eruda (mobile debug) │
                 └───────┬───────────────┬──────────────┬───────┘
                         │               │              │
        Storefront API   │               │ Supabase JS  │  static hosting
        (catalog, GLB,   │               │ (auth +      │  + deploy
         metafields)     ▼               ▼  projects)   ▼
                 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                 │   Shopify    │  │   Supabase   │  │    Vercel    │
                 │  (commerce)  │  │ (auth + DB)  │  │ (GitHub CI)  │
                 └──────────────┘  └──────────────┘  └──────────────┘
```

- **Frontend:** Vanilla JS + three.js, no framework. Single-file `main.js`.
  State held in two arrays: `walls[]` and `placedItems[]`, serialised to JSON.
- **Commerce:** Shopify Storefront API. Products carry `planner.*` metafields
  (`glb_url`, `width_mm`, `height_mm`, `depth_mm`, `category`). Token is public-safe.
- **Auth + data:** Supabase (Google OAuth today; Shopify customer one-login bridge is Phase 2).
  `projects` table stores `scene_json` (jsonb) + thumbnail (Storage URL), keyed by `user_id`.
- **Hosting:** Vercel, auto-deploy from GitHub `main` (`brandonlee-ct/kitchen-planner-v3`).

### Near-term architecture (status)

1. **RLS + roles in Supabase** — ✅ enabled (security-critical, see §4).
2. **`cartCreate` → checkout** — ✅ done (commerce loop live).
3. **Thumbnails in Supabase Storage** — ✅ done (`uploadThumbnail`, DB rows stay light).
4. **Shopify embed** — P1: **subdomain link** to `planner.brownboxkit.co.nz`. Phase 2:
   **App Proxy** (`/apps/planner`, first-party). Raw iframe rejected (breaks auth/checkout on mobile).
5. **Shopify Customer Account → Supabase JWT bridge** — **Phase 2** (Opus design; needs an
   Edge Function to verify the App Proxy HMAC and mint a session).

I am **not** recommending splitting `main.js` before launch. Keep the monolith for speed;
modularise only if it becomes a maintenance blocker post-launch.

---

## 3. Data model (proposed Supabase schema)

```
auth.users                (managed by Supabase Auth)
└─ profiles               1:1 with auth.users
     id          uuid  PK  → auth.users.id
     role        text      'user' | 'staff' | 'admin'   (default 'user')
     display_name text
     created_at  timestamptz

projects
     id          uuid  PK
     user_id     uuid  FK → auth.users.id
     name        text
     scene_json  jsonb         (walls[] + placedItems[])
     thumbnail   text          → later: Storage path, not base64
     is_public   bool default false   (for share links)
     share_slug  text unique          (random token; share URL = /?p=<share_slug>)
     created_at / updated_at  timestamptz

analytics_events           (Task 1.12)
     id, user_id (nullable), event text, payload jsonb, created_at
```

- **Storage bucket** `thumbnails/` (Task 1.9, done) — public-read, owner-write.
- **Share links** (Task 1.11, Option B): a row with `is_public = true` + a random
  `share_slug`; anonymous read goes only through a `security definer` RPC
  `get_shared_project(slug)` — **no broad public-select policy**, so shared projects can't
  be enumerated.

---

## 4. Auth & permissions (the security foundation)

**The critical gap today:** `projects` is guarded only by client-side `.eq('user_id', …)`.
With the public anon key, that is **not** real protection. **Row Level Security must be
enabled.** This is the #1 task before sharing with real, account-creating testers.

**Roles** (recommended, pending your choice):
- `admin` = you (and trainee?) — read all projects, view analytics, manage catalog mapping.
- `staff` = Brown Box Kit team (optional middle tier).
- `user` = customers — only their own projects.

**RLS policy shape (conceptual):**
- `projects` SELECT/INSERT/UPDATE/DELETE → `auth.uid() = user_id` **OR** caller is admin.
- Public/share read → **not** a broad `is_public` select policy; instead a `security
  definer` RPC `get_shared_project(slug)` returns a single row by `share_slug` (Option B,
  no enumeration).
- `profiles` → users read/update own row; admins read all.

I will provide **copy-paste SQL** for all of this (you approved Supabase access).
You run it in the Supabase SQL editor — no dashboard guesswork.

---

## 5. Shopify integration plan

| Concern | Approach | Owner |
|---|---|---|
| Catalog + GLB + dims | Storefront API + `planner.*` metafields (done) | done |
| Live pricing | Read variant price, sum in quote panel (done for placed items) | done |
| Send to Cart | `cartCreate` mutation → redirect to `cart.checkoutUrl` — ✅ **done** | done |
| Embed in storefront | P1: **subdomain link** to `planner.brownboxkit.co.nz`. Phase 2: **App Proxy** `/apps/planner` (first-party) | me + you (Shopify admin) |
| Customer login = planner login | **App Proxy HMAC → Edge Function → Supabase session** — **Phase 2** | **Opus design** → me |

**Your part (only you can):** add/verify `planner.*` metafields on products in Shopify
admin, confirm the Storefront token + scopes, and (Phase 2) create the custom app + App Proxy.

---

## 6. Scope by phase (annotated with owner + dependency)

### Phase 0 — Live Prototype ✅ COMPLETE
Live · Shopify catalog · Google auth · Save/Load via Supabase.

### Phase 1 — Shopify MVP Launch
Status against the current build (see `TASKS.md` for the live board):

| Task | Status |
|---|---|
| 1.1 Bug-fix sweep · Security (RLS + `profiles`/roles) | ✅ done |
| 1.2 Drawing UX overhaul · 1.3 Mobile toolbar · 1.5 elevation editor | ✅ done |
| Send-to-Cart (`cartCreate`) · 1.4 power points · 1.9 thumbnails→Storage | ✅ done |
| 1.8 Quote PDF (Tier 0) | ⏳ partial (deps installed; button/handler/photos remain) |
| 1.11 share links (Option B) · 1.12 analytics · 1.13 privacy/T&Cs/export | ⬜ remaining |
| 1.10 snap rules (Opus design first) | ⬜ remaining |
| 1.6 embed = subdomain link · 1.14 pre-launch review (Opus) | ⬜ remaining |

**Deferred to Phase 2:** App Proxy + one-login JWT bridge (was 1.7), Quote PDF Tier 1
(settings panel) and Tier 2 (drag-and-drop canvas designer).

### Phase 2 — Pro Features (parked until launch ships)
Realistic rendering (HDRI/PBR/shadows), first-person walkthrough, gamepad, Bluetooth
Disto/GLM, iOS mm fallback, swatches, benchtop extrusion, splashback/appliance library,
offline mode, Apple Pencil, per-wall thickness, multi-room, 4K/AI render + LED strips,
construction-plan PDF, elevation A/B/C/D sheets, cross-section, lighting, drag colour,
wall-cut tool, plan underlay import.

### Phase 3 — White-Label SaaS (far future, NOT planned)
The business is now a **single entity** (per `FEASIBILITY.md`), so multi-tenancy is **not**
day-one work. If ever pursued, it is an explicit re-architecture: multi-tenant data model,
CSS theming, admin dashboard, SaaS subscription billing (B2B, not customer payments),
per-tenant Shopify connect, usage metering, versioning, team accounts, public API.

---

## 7. Milestones (clarified)

- **Milestone A — Harden the live prototype.** ✅ done (1.1 fixes, RLS/roles, toasts, 2D labels).
- **Milestone B — Shopify MVP launch.** Mostly done (drawing UX, mobile toolbar, Send-to-Cart,
  thumbnails→Storage, power points). **Remaining:** finish Quote PDF (Tier 0), share links,
  analytics, snap rules, subdomain-link embed, privacy/T&Cs/export, pre-launch review.
- **Milestone C — Phase 2 onward.** App Proxy + one-login JWT bridge, Quote PDF Tier 1/2,
  then the monorepo apps (Trade, Academy, KPI, Inventory) per `FEASIBILITY.md`.

---

## 8. Delegation model (your PM workflow)

> **Superseded (13 Jul 2026).** The delegation model is now the S / O / H / A structure —
> see [ROLES.md](ROLES.md) for the full charters and boot prompts: **H** = owner (apex,
> approves gates), **O** = PM Opus (planning, architecture escalation, task briefs),
> **S** = Composer coding sub-agent (bounded builds), **A** = Fable auditor (owner-side
> assurance). The `executor`/`reviewer` subagents exist in `.cursor/agents/` and serve
> the O→S pipeline. **Source of truth for status = `TASKS.md`.**

---

## 9. Risks & open decisions

1. **Security must land before public sign-ups** (RLS). ✅ enabled — keep it that way.
2. **One-login bridge (Phase 2)** is the trickiest piece — Opus design + an Edge Function
   that verifies the App Proxy HMAC server-side; never trust a client-supplied customer id.
3. **`main.js` size** (~8400 lines) — fine for now; watch for it slowing iteration.
4. **Real-device testing** — I can't tap a physical screen; trainee/you must verify touch
   (incl. the "done" items: power points, thumbnails, Send-to-Cart).
5. **Share-link enumeration** — must use the Option B RPC, not a broad public-select policy.

---

## 10. Immediate next steps

1. Finish **1.8 Quote PDF (Tier 0)** — button + handler + `featuredImage` photo fetch.
2. **1.11 share links (Option B)** — `get_shared_project` RPC SQL (you run) + Share/unshare
   UI + read-only `?p=<slug>` load.
3. **1.12 analytics** (table SQL + `trackEvent` hooks), then **1.10 snap rules** (Opus
   design first), **1.6 subdomain-link embed**, **1.13 privacy/T&Cs/export**.
4. **1.14 pre-launch review** (Opus), then begin Phase 2 (App Proxy + bridge, monorepo).
