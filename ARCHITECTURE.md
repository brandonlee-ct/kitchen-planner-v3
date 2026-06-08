# Brown Box Kit Kitchen Planner — Architecture & Scope (as reviewed)

> Planning document. No application code is changed by this file.
> Tip: read this with Markdown Preview (`Ctrl+Shift+V`) for full-width formatting.

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
- **Auth + data:** Supabase (Google OAuth today; Shopify customer bridge planned).
  `projects` table stores `scene_json` (jsonb) + thumbnail, keyed by `user_id`.
- **Hosting:** Vercel, auto-deploy from GitHub `main` (`brandonlee-ct/kitchen-planner-v3`).

### Recommended near-term architecture (deltas)

1. **Enable RLS + roles in Supabase** (security-critical — see §4).
2. **Add `cartCreate` → checkout** (commerce loop; not yet in code).
3. **Move thumbnails to Supabase Storage** (DB rows stay light).
4. **Shopify Customer Account → Supabase JWT bridge** (so storefront login = planner login).
5. **Embed via App Block** (iframe acceptable for testing).

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
     share_slug  text unique          (for /p/abc123)
     created_at / updated_at  timestamptz

analytics_events           (Task 1.12)
     id, user_id (nullable), event text, payload jsonb, created_at
```

- **Storage bucket** `thumbnails/` (Task 1.9) — public-read, owner-write.
- **Share links** (Task 1.11): a row with `is_public = true` + `share_slug`; a read-only
  RLS policy exposes only public rows by slug.

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
- Public read → `is_public = true` (for share links only; exposes safe columns).
- `profiles` → users read/update own row; admins read all.

I will provide **copy-paste SQL** for all of this (you approved Supabase access).
You run it in the Supabase SQL editor — no dashboard guesswork.

---

## 5. Shopify integration plan

| Concern | Approach | Owner |
|---|---|---|
| Catalog + GLB + dims | Storefront API + `planner.*` metafields (done) | done |
| Live pricing | Read variant price, sum in quote panel (done for placed items) | mostly done |
| Send to Cart | `cartCreate` mutation → redirect to `cart.checkoutUrl` (**not built**) | me |
| Embed in storefront | **App Block** (proper) / iframe (fast test) | me + you (Shopify admin) |
| Customer login = planner login | **Customer Account → Supabase JWT bridge** (hard) | **Opus design** → me |

**Your part (only you can):** add/verify `planner.*` metafields on products in Shopify
admin, confirm the Storefront token + scopes, and install the App Block on the theme.

---

## 6. Scope by phase (annotated with owner + dependency)

### Phase 0 — Live Prototype ✅ COMPLETE
Live · Shopify catalog · Google auth · Save/Load via Supabase.

### Phase 1 — Shopify MVP Launch
Re-ordered by **critical path** (not by number):

| Order | Task | Owner | Notes / blocks |
|---|---|---|---|
| 1 | 1.1 Bug-fix sweep (wall selection regression, toasts, 2D labels) | me | Unblocks real testing |
| 2 | **Security**: RLS + `profiles`/roles | me + you (run SQL) | Before public sign-ups |
| 3 | 1.2 Drawing UX overhaul (snap guides, mm inputs, weld fix, auto-floor) | me | Your stated #1 pain |
| 4 | 1.3 Mobile toolbar (44px icons, hamburger, camera capture) | me | Multi-device goal |
| 5 | Send-to-Cart + 1.6 embed | me + you | Completes funnel |
| 6 | 1.8 Quote PDF · 1.9 thumbnails→Storage · 1.11 share links | me | |
| 7 | 1.4 power points · 1.5 5-dim editor | Opus design → me | three.js math |
| 8 | 1.7 auth bridge · 1.10 snap rules · 1.14 review | Opus-led | Architectural |
| 9 | 1.12 analytics · 1.13 privacy/T&Cs/export | me + you (legal) | Late |

### Phase 2 — Pro Features (parked until launch ships)
Realistic rendering (HDRI/PBR/shadows), first-person walkthrough, gamepad, Bluetooth
Disto/GLM, iOS mm fallback, swatches, benchtop extrusion, splashback/appliance library,
offline mode, Apple Pencil, per-wall thickness, multi-room, 4K/AI render + LED strips,
construction-plan PDF, elevation A/B/C/D sheets, cross-section, lighting, drag colour,
wall-cut tool, plan underlay import.

### Phase 3 — White-Label SaaS (future)
Multi-tenant data model, CSS theming, admin dashboard, Stripe Billing, per-tenant Shopify
connect, usage metering, project versioning, team accounts, public API, marketing site.

---

## 7. Milestones (clarified)

- **Milestone A — Harden the live prototype (≈1 day).** Fix 1.1 + visible toasts + 2D
  labels after load; deploy. *Add RLS/roles in parallel before opening sign-ups.* The link
  already exists — this makes it safe + smooth for testers and your trainee.
- **Milestone B — Shopify MVP launch (≈1–2 weeks).** Drawing UX overhaul, mobile toolbar,
  Send-to-Cart, embed, PDF quote, thumbnails→Storage, share links.
- **Milestone C — Auth bridge + polish + pre-launch review.** 1.7, 1.10, 1.14.

---

## 8. Delegation model (your PM workflow)

- **Opus** = architect/PM brain: auth bridge, schema/security sign-off, three.js math,
  pre-launch review. Writes task briefs.
- **Me (Cursor executor)** = implements briefs, edits + runs code, checkpoints to git,
  reports real results. Owns ~90% of execution.
- **Trainee (human)** = guided tasks: real-device testing (iPhone/iPad/Android), Shopify
  admin data entry (metafields), QA against a checklist, content drafts. I can produce
  step-by-step task briefs for them.
- **Reusable subagents** (proposed, awaiting your go-ahead to create the files):
  - `executor` — implements a task brief; obeys `AGENTS.md` house rules.
  - `reviewer` — read-only; checks a change for touch+mouse parity, undo/redo history,
    three.js dispose, and breakpoint compliance before you ship.
- **Source of truth** = your Master Scope; I can keep a living `TASKS.md` status board.

---

## 9. Risks & open decisions

1. **Security must land before public sign-ups** (RLS). Highest risk if skipped.
2. **Auth bridge (1.7)** is the trickiest piece — design with Opus before coding.
3. **`main.js` size** — fine for now; watch for it slowing iteration.
4. **Real-device testing** — I can't tap a physical screen; trainee/you must verify touch.
5. **Decisions needed from you:**
   - Role tiers: `admin/user` only, or add `staff`? (affects RLS now)
   - Approve creating the `executor`/`reviewer` subagents + `TASKS.md`?
   - Confirm Milestone A scope (harden, not rebuild).

---

## 10. Immediate next steps (on your approval)

1. Root-cause + fix **1.1** wall-selection regression (touch raycast path).
2. Provide **RLS + roles SQL** for you to paste into Supabase.
3. Create **`executor` + `reviewer` subagents** and a **`TASKS.md`** board.
4. Deploy hardened build; you + trainee test on real devices and log feedback.
