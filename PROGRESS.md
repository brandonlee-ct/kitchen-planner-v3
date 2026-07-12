# Brown Box Kit Planner — Progress Snapshot

> PM-level status at a glance. The living board is [TASKS.md](TASKS.md) (single source of
> truth for what's done / next); [ROADMAP.md](ROADMAP.md) is the plain-English plan. This
> file summarises — update TASKS.md, not this, when a task moves.

_Last updated: 13 Jul 2026 (LEGEND added by A on owner instruction)._

## LEGEND

> Full role charters + fresh-chat boot prompts: [ROLES.md](ROLES.md).

**Owner**

- `S` = coding sub-agent (Composer 2.5 Standard; formerly Sonnet)
- `O` = PM
- `H` = Human
- `A` = Fable auditor / owner advisor (owner-side, separate chat; audits PM outputs against authority at file/git level, flags drift, advises the owner, drafts owner→PM prompts; read-mostly — amends control docs only on explicit owner sign-off; never builds, never approves phase gates)

**Task IDs (PM convention, not control authority)**

- `O#` = PM planning/contract task (sequential)
- `S#` = coding sub-agent build task (sequential)
- Gates are `H` sign-offs and carry no task ID

**Status**

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked
- `[?]` needs human decision

### Role briefs

- **`S` — coding sub-agent (builder).** Implements exactly ONE bounded task brief at a time
  off current `main`, obeying `AGENTS.md` house rules (no refactors, touch+mouse parity,
  undo/redo intact, dispose pattern, metres/mm). Never invents scope, never merges its own
  work, never touches schema/RLS/shared contracts without a stop-and-ask. Output: one small
  reviewable unit + a "how to test" note.
- **`O` — PM (planner/contractor).** Owns sequencing and task contracts: writes `O#`/`S#`
  briefs, keeps `TASKS.md` (the single source of truth) current at the end of every task,
  reconciles doc contradictions by amendment (never cherry-picks), and reports honestly —
  "built" is not "verified". Escalates architecture/auth/security/schema to Opus and
  decisions to `H`.
- **`H` — Human (owner).** The only role that approves phase gates. Does what only the
  account owner can: applies SQL in Supabase, Shopify admin settings, live-site smoke tests
  on real devices, business/legal calls. A task is not "done" until `H`-verifiable on
  planner.brownboxkit.co.nz.
- **`A` — Fable auditor / owner advisor.** Owner-side, separate chat. Audits PM outputs
  against authority at file/git level, flags drift or hallucination, advises the owner, and
  drafts owner→PM prompts. Read-mostly: amends control docs only on explicit owner
  sign-off. Never builds, never approves phase gates.

## Status: LIVE
Phase 1 launched **14 Jun 2026** at `planner.brownboxkit.co.nz`, linked from Shopify nav
("Design Your Kitchen"). Live smoke test passed: sign-in, draw room, place cabinet,
save/reload, Send to Cart, quote PDF.

## Shipped
- **Milestone A — Harden prototype:** bug-fix sweep (touch wall selection iOS/Android,
  save/load toasts, 2D labels after load); Supabase **RLS enabled** on `projects` +
  `profiles`, roles + admins live, thumbnails bucket.
- **Milestone B — Shopify MVP:** Free Draw + Quick Draw (camera lock, 90 deg snap, angle
  guides, parametric rescale, auto-floor, 300mm slab); mobile toolbar; Send to Cart
  (`cartCreate` -> checkout); Quote PDF + CSV; thumbnails -> Supabase Storage; power
  points in elevation; elevation/3D dimension editor; embed mode (`?embed=1`); read-only
  share links (`?share=<slug>`).
- **Milestone C:** snap rules / height tiers; analytics stub (`trackEvent`); privacy +
  T&Cs; pre-launch architecture review (blockers B1-B4 fixed).
- **Phase 2 (Pro):** Bluetooth laser measurement (Task Y) — confirmed on Bosch GLM
  50-27 CG, Leica/Disto UART fallback, Chrome + Edge desktop.

## In progress
- **Auto-design "magic button"** — wiring the already-built solver
  ([auto-design.js](auto-design.js) + [auto-design-rules.js](auto-design-rules.js),
  unit-tested) into the planner via a wizard + adapter + toolbar button. Follows
  [AUTO-DESIGN-PLAN.md](AUTO-DESIGN-PLAN.md) Phases 2-3. Ships behind the
  `window.AUTO_DESIGN_ENABLED` kill switch.

## Open / next
- **1.7 Shopify -> Supabase single-login bridge** — last Phase 1 item, deferred
  (not blocking launch); flagged needs-Opus (architecture).
- **Auto-design Phase 4 polish** (deferred follow-up): glide-draw handoff, warnings
  drawer, Clear/Regenerate buttons, NZBC disclaimer copy.
- **P2 `bbk-suite` monorepo** — separate business track (Trade/Academy/KPI/Inventory)
  sharing the planner's Supabase project; foundation brief in
  [P2-MONOREPO-BRIEF.md](P2-MONOREPO-BRIEF.md).

## Known constraints
- iOS Safari has no Web Bluetooth (laser measure falls back with a Bluefy hint).
- Auto-design solver only matches catalogue products with `category: "base"` and standard
  widths (900/800/600/500/400/300mm); unmatched cabinets surface as "skipped" warnings.
