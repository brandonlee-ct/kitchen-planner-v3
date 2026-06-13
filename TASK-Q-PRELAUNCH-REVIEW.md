# Task Q — Planner v1.0 Pre-Launch Review

> The launch gate for the Planner. This is the written inspection that backs the
> "Q complete" tick on the board. It folds in `HANDOFF_AUDIT.md` (code hygiene) and
> adds the checks that audit deliberately did **not** cover: security (RLS),
> functional smoke test, and live-site verification.
>
> **Reviewer:** Opus (architecture) · **Date:** 2026-06-14 · **Branch:** `main`
> **Scope:** `main.js`, `auth.js`, `index.html`, `style.css`, `vercel.json`

Status legend: **PASS** = verified OK · **OPEN** = needs a small fix · **OWNER** =
needs you / Supabase dashboard (not visible in code) · **DEFERRED** = known, Phase 2.

---

## 0. Verdict

**Not launch-blocked by code — blocked by one unverified security check.**

The only true gate is **§1.1 RLS**. Everything else is either PASS or a trivial
cleanup. If RLS is confirmed enabled on `projects` and the `thumbnails` bucket, the
Planner is launch-ready once the §3 smoke test passes on the live site.

| Area | Result |
|---|---|
| 1. Security | **OWNER** — RLS must be confirmed (the one real gate) |
| 2. Code hygiene | PASS — trivial leftovers cleared (§2.2/§2.3) |
| 3. Functional smoke | PASS in code; **must re-run live** |
| 4. Live verification | OWNER — verify on planner.brownboxkit.co.nz |
| 5. Deferred gaps | DEFERRED — documented, acceptable for v1.0 |

---

## 1. Security (the real gate — not covered by the audit)

### 1.1 Row Level Security — **OWNER / MUST VERIFY**
The Supabase anon key and Shopify Storefront token are embedded in the frontend.
Per the house rules this is **only safe if RLS is enabled**. The client-side
`.eq('user_id', _user.id)` filters in `auth.js` are belt-and-braces, **not** a
substitute. This cannot be verified from code — check in the Supabase dashboard:

- [ ] RLS **enabled** on `public.projects`.
- [ ] Policies scope every row to `auth.uid()` for select / insert / update / delete.
- [ ] `share_slug` / `is_public` read path: a public-share SELECT is allowed **only**
  when `is_public = true` (so `loadPublicProject` works without leaking private rows).
- [ ] `thumbnails` storage bucket: write policy scoped to `${auth.uid()}/...`; public
  read is acceptable (thumbnails are non-sensitive) — confirm that's intended.

> This is the #1 launch risk in every planning doc. Do not launch until ticked.

### 1.2 Secrets — **PASS**
No service-role keys or `.env` secrets in client code. Anon key + Storefront token
are public-safe by design. `.env*` gitignored.

---

## 2. Code hygiene (HANDOFF_AUDIT.md, re-verified at current line numbers)

### 2.1 Dead code / duplicate-save bug — **RESOLVED THIS SESSION**
The audit's headline finding (`updateProject` exported but never imported → "Save"
only inserted → duplicate rows) is **fixed and shipped** (commit `ecb3cf7`):
`updateProject` is now wired and `currentProjectId` is tracked, so Save updates the
open project in place. New designs insert once; deleting the open project resets the id.

### 2.2 Leftover editing artifacts — **RESOLVED**
Removed (cosmetic, no behaviour change): the two `// REPLACE WITH:` artifacts and the
`// redeploy trigger` comment.

### 2.3 Debug leftovers — **RESOLVED**
Removed the untagged `console.log('Loaded', ... 'products from Shopify')` and the
`window._debug = { serialiseScene, clearScene, loadScene }` hook (no longer ships).

### 2.4 Null-safe button wiring — **OPEN (fragility, house-rule deviation)**
**~76** handlers use the non-null-safe pattern
`document.getElementById('x').addEventListener(...)`. The house rule mandates
`const el = getElementById('x'); if (el) el.addEventListener(...)` — because one
missing element ID throws and kills **every handler wired after it** in the file.
These work today (the IDs all exist — audit confirmed the ID contract is intact), so
this is **not** a launch blocker, but it is a real fragility for future edits.
**Recommendation:** leave for v1.0; harden opportunistically, do not mass-refactor.

### 2.5 Config candidate — **OPEN (hygiene, optional)**
`SHOPIFY_API_VERSION = '2025-01'` (`main.js`) needs periodic bumping as Shopify
deprecates versions — good candidate to move to build config. Not a launch item.

### 2.6 Build — **PASS**
`npm run build` succeeds (vite, exit 0). No unused dependencies. No linter errors.

---

## 3. Functional smoke test (must re-run on the live site — no automated tests by design)

Verify on **desktop + iPhone + iPad** (the three input paths):

- [ ] Save Project → exactly **one** row in My Projects (the bug fix); re-Save → row
  **updates**, no duplicate ("Updated ✓").
- [ ] Save Project & Restart Planner (hamburger).
- [ ] Long-press select on touch.
- [ ] Cabinets sit on the 300 mm slab — place, save, reload, still correct.
- [ ] Power point (GPO) button in elevation.
- [ ] Quote CSV + PDF export.
- [ ] Door/window select + drag along wall with live dimensions.
- [ ] Undo / redo.
- [ ] Zoom speed normal with a cabinet selected.
- [ ] Elevation dimension editor (Task K): select highlights green, 7-dim chain,
  cabinet width/height read-only, edits write back.
- [ ] Share link: create, open in a private window → read-only, no save.

---

## 4. Live verification — **OWNER**
A task is not done until verified live (house rule):
- [ ] Confirm Vercel deployed commit `ecb3cf7` to **planner.brownboxkit.co.nz**.
- [ ] Run §3 smoke test against the live URL, not a local preview.
- [ ] Confirm `?embed=1` renders slim chrome inside a Shopify page (CSP
  `frame-ancestors` is set in `vercel.json`).

---

## 5. Known deferred gaps (accepted for v1.0 — Phase 2)
Documented and acceptable to launch with:
- Grey boxes when a Shopify GLB metafield is missing.
- No cabinet-vs-cabinet collision detection.
- Interior-side wall snap imperfect.
- Analytics is stubbed (`trackEvent` → console; not persisted).
- "Download my data" export not built (Privacy Act nicety, not a blocker for v1.0).
- Shopify Customer-Account → Supabase JWT bridge (Phase 2 by design).

---

## 6. Sign-off
| Gate | Owner | Status |
|---|---|---|
| RLS verified (projects + thumbnails) | Owner | ☐ |
| Smoke test passed live (desktop+touch) | Owner | ☐ |
| Vercel deploy of `ecb3cf7` confirmed live | Owner | ☐ |
| Trivial cleanups (§2.2/2.3) | Done | ☑ |

**Launch when the top three boxes are ticked.** The cleanups can follow.
