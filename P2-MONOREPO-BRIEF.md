# P2 — Monorepo Foundation: Architect Brief (Cursor B)

> **What this is:** a single, code-ready brief for the P2 monorepo foundation, to be executed
> by a Cursor agent in **Account B** (the new `bbk-monorepo`). It is scoped to **foundation only** —
> identity, tenancy, RLS, and the Inngest webhook pipeline. **No** Trade business logic (dispatch,
> payments, KPI, operators) — those are P4+ and out of scope here.
>
> **Critical safeguard:** the monorepo uses the **same Supabase project as the planner**. The
> planner may already have a `profiles` table + roles (ARCHITECTURE.md says RLS/profiles is "done").
> **Inspect the live schema before running any SQL.** The migration below is written to be
> idempotent, but a human must confirm it against the live database first.

---

## 1. Locked decisions (P2 only)

- **Monorepo:** pnpm workspaces + Turborepo. **TypeScript** everywhere.
- **Packages:** `packages/shared` (Supabase + auth + roles + types) and `packages/inngest`
  (Inngest client + event vocabulary + functions). **App:** `apps/trade` (skeleton only).
- **Database:** **SHARED** — one Supabase project, all apps in `public` schema, table naming
  conventions per group (`trade_*`, `academy_*`, `kpi_*`, `inventory_*`). RLS + `tenant_id`
  scopes data. KPI reads Trade + Academy in direct SQL — cross-app queries are the whole point.
  Upgrade path if needed: shared → isolated schemas (rename + search-path, no app rewrite).
- **Auth:** Supabase **Google OAuth**, patterns **copied** from the planner's `auth.js` (copied,
  not imported, not symlinked).
- **Roles:** stored as a **text column with a CHECK** (not a PG enum, so we can add roles later
  without a migration). P2 values: `admin | staff | installer | user`. Operator-specific roles
  (`operator_owner | pm | sales | territorial_manager`) are **reserved for P4**, not added now.
- **Tenancy prep:** every table carries `tenant_id`, defaulting to a single seeded **`bbk`** tenant.
  The full **JWT-claim auth hook is DEFERRED** (white-label phase); for P2, `current_tenant()`
  returns the `bbk` tenant id (reads a JWT claim if one is ever present).
- **RLS:** enabled on every new table at creation. Mandatory.
- **Webhooks:** **Inngest** (locked). `packages/inngest` owns the client, the event vocabulary, and
  the `shopify/order.paid` function. Shopify **HMAC is verified at the serve endpoint** before any
  event is sent.
- **Writes from the webhook path use the Supabase service-role key** (server-side only; bypasses
  RLS). The anon key is client-only.
- **Hosting:** Vercel (one app: `apps/trade`). Deploy wiring can be minimal in P2.
- **Out of scope for P2:** dispatch, payments/Stripe, operators/zones, KPI/demerits, the project-file
  widgets, SMS/voice, maps. Foundation only.

---

## 2. Repository file structure

```text
bbk-monorepo/
├─ AGENTS.md                      # house rules for THIS repo (see §9 prompt 1)
├─ package.json                   # root, workspaces + turbo scripts
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ .gitignore
├─ .env.example                   # documents required env vars (no secrets)
├─ packages/
│  ├─ shared/
│  │  ├─ package.json             # name: @bbk/shared
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ index.ts              # re-exports
│  │     ├─ supabase.ts           # client factory
│  │     ├─ auth.ts               # Google OAuth wrapper (from auth.js patterns)
│  │     ├─ roles.ts              # role helpers
│  │     └─ types.ts              # Tenant, Profile, Role, Job, WebhookInbox
│  └─ inngest/
│     ├─ package.json             # name: @bbk/inngest
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts
│        ├─ client.ts             # Inngest client
│        ├─ events.ts             # event vocabulary (typed)
│        └─ functions/
│           └─ order-paid.ts      # shopify/order.paid -> webhook_inbox + jobs
├─ apps/
│  └─ trade/
│     ├─ package.json             # name: @bbk/trade
│     ├─ tsconfig.json
│     ├─ vite.config.ts
│     ├─ index.html
│     ├─ src/
│     │  └─ main.ts               # sign-in + "signed in as <role>" + jobs list (read-only)
│     └─ api/
│        └─ inngest.ts            # Inngest serve endpoint + Shopify HMAC verify
└─ supabase/
   └─ migrations/
      └─ 0001_foundation.sql      # the schema below (REVIEW before running)
```

---

## 3. SQL schema — foundation tables (`supabase/migrations/0001_foundation.sql`)

> Idempotent and defensive: safe to re-run, and won't clobber a `profiles` table the planner
> already created. **Run only after inspecting the live schema.** Defaults cannot use subqueries,
> so `tenant_id` is set by the trigger (new profiles) and by the service-role writer (inbox/jobs).
>
> **APPLIED 2026-06-15 against the shared Supabase.** The live `profiles` table predated this
> migration with only a 3-role CHECK (`user|staff|admin`) and RLS already enabled, so a
> pre-step (below) widens the CHECK to include `installer` before the migration runs. Two
> hardening fixes are baked in vs the original draft: `profiles_self_update` now has an explicit
> `with check` that pins the `role` column (blocks self-escalation to admin), and the trigger
> guard matches on `tgrelid` not just the trigger name.

```sql
-- ── PRE-STEP (only needed because the planner's profiles table already had a
--    narrower CHECK). Run this ONCE before the migration; skip on a fresh DB. ──
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','staff','installer','user'));
```

```sql
-- ── Tenants ──────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

insert into public.tenants (slug, name)
values ('bbk', 'Brown Box Kit')
on conflict (slug) do nothing;

-- ── Profiles (REUSE if the planner already created it) ────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'user'
               check (role in ('admin','staff','installer','user')),
  created_at   timestamptz not null default now()
);

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);

update public.profiles
  set tenant_id = (select id from public.tenants where slug = 'bbk')
  where tenant_id is null;

-- ── Helper functions ─────────────────────────────────────────────────
create or replace function public.current_tenant() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    (select id from public.tenants where slug = 'bbk' limit 1)
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Auto-create a profile on new auth user (skip if planner already has one) ──
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, tenant_id, role, display_name)
  values (
    new.id,
    (select id from public.tenants where slug = 'bbk'),
    'user',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- ── Webhook inbox (Inngest dedup + audit) ─────────────────────────────
create table if not exists public.webhook_inbox (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id),
  source       text not null default 'shopify',
  topic        text not null,
  webhook_id   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, webhook_id)
);

-- ── Jobs (minimal foundation; expanded in P4) ─────────────────────────
create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id),
  shopify_order_id text not null,
  status           text not null default 'new',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, shopify_order_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.tenants       enable row level security;
alter table public.profiles      enable row level security;
alter table public.webhook_inbox enable row level security;
alter table public.jobs          enable row level security;

drop policy if exists tenants_read on public.tenants;
create policy tenants_read on public.tenants
  for select to authenticated using (id = public.current_tenant());

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using  (id = auth.uid())
  with check (
    id   = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists jobs_staff_read on public.jobs;
create policy jobs_staff_read on public.jobs
  for select to authenticated using (
    tenant_id = public.current_tenant()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','staff')
    )
  );

-- webhook_inbox: intentionally NO policies -> only the service role (which bypasses
-- RLS) can read/write it. Same for jobs writes (service role only in P2).
```

---

## 4. `packages/shared` — API contract

```ts
// supabase.ts
export function createSupabaseClient(opts: {
  url: string; anonKey: string;
}): SupabaseClient;

// auth.ts  (patterns copied from planner auth.js, not imported)
export function initAuth(client: SupabaseClient, onChange: (user: User | null) => void): void;
export function signInWithGoogle(client: SupabaseClient): Promise<void>;
export function signOut(client: SupabaseClient): Promise<void>;
export function getUser(client: SupabaseClient): Promise<User | null>;
export function getSession(client: SupabaseClient): Promise<Session | null>;

// roles.ts
export type Role = 'admin' | 'staff' | 'installer' | 'user';
export function getProfile(client: SupabaseClient, userId: string): Promise<Profile | null>;
export function hasRole(profile: Profile | null, roles: Role[]): boolean;
export function isAdmin(profile: Profile | null): boolean;

// types.ts
export interface Tenant   { id: string; slug: string; name: string; }
export interface Profile  { id: string; tenant_id: string; role: Role; display_name: string | null; }
export interface Job      { id: string; tenant_id: string; shopify_order_id: string; status: string; created_at: string; updated_at: string; }
export interface WebhookInbox { id: string; tenant_id: string; source: string; topic: string; webhook_id: string; payload: unknown; received_at: string; processed_at: string | null; }
```

Rules: no secrets baked in; the client is created from env vars by the consumer (the app passes
`VITE_*`, the server passes service-role separately — `@bbk/shared` never reads `process.env`
directly so it works in both browser and server).

---

## 5. `packages/inngest` — API contract + event vocabulary

```ts
// client.ts
export const inngest = new Inngest({ id: 'bbk-trade' });

// events.ts — the typed vocabulary
export type Events = {
  'shopify/order.paid': {
    data: {
      webhookId: string;       // X-Shopify-Webhook-Id (idempotency key)
      topic: string;           // e.g. "orders/paid"
      shopifyOrderId: string;
      tenantSlug: string;      // 'bbk' for now
      order: unknown;          // raw verified Shopify order payload
    };
  };
  'job/created': {            // emitted AFTER a jobs row is created (fan-out hook)
    data: { jobId: string; tenantSlug: string; shopifyOrderId: string };
  };
};
```

### Event vocabulary (P2 implemented + P4 reserved)
- **Implemented in P2:**
  - `shopify/order.paid` — a verified, deduped paid Shopify order arrived.
  - `job/created` — a `jobs` row was created (no consumers yet; reserved for dispatch/notifications).
- **Reserved for P4 (do NOT implement now, just document):**
  `job/offered`, `job/accepted`, `job/declined`, `job/completed`,
  `payment/claim.issued`, `payment/received`, `demerit/recorded`.

### `functions/order-paid.ts` behaviour
1. Triggered by `shopify/order.paid`.
2. Resolve `tenant_id` from `tenantSlug`.
3. **Insert into `webhook_inbox`** with `unique(source, webhook_id)` — on conflict, **stop**
   (duplicate delivery → no-op).
4. **Upsert a `jobs` row** keyed by `unique(tenant_id, shopify_order_id)`.
5. Set `webhook_inbox.processed_at`.
6. **Send `job/created`** (only when a new job was actually created).
7. Uses the **service-role** Supabase client (server-side).

### Serve endpoint `apps/trade/api/inngest.ts`
- Hosts the Inngest functions.
- **Verifies the Shopify HMAC** (timing-safe, using `SHOPIFY_WEBHOOK_SECRET`) on the raw body
  **before** calling `inngest.send('shopify/order.paid', ...)`. Reject (401) on bad HMAC.

---

## 6. `apps/trade` — skeleton scope (P2)
- Vite + TS PWA shell importing `@bbk/shared`.
- Screen 1: Google sign-in / sign-out; shows "Signed in as `<name>` (`<role>`)".
- Screen 2: a **read-only** jobs list (calls Supabase via `@bbk/shared`; visible only to
  `admin`/`staff` per RLS). Empty state is fine.
- `api/inngest.ts` serve endpoint (see §5).
- No other features.

---

## 7. Environment variables (`.env.example`)

```bash
# Client (browser) — same values as the planner
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server only — NEVER expose to the browser
SUPABASE_SERVICE_ROLE_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
SHOPIFY_WEBHOOK_SECRET=
```

`.env` is gitignored. The service-role key and signing keys are server-only (used by
`api/inngest.ts` and the Inngest function).

---

## 8. Build steps + acceptance criteria

1. **AGENTS.md + repo init** — create the monorepo house rules (see §9).
   - *Accept:* file exists; states two-repo separation, stack, tenant_id rule, RLS-mandatory,
     schema needs human review.
2. **Monorepo skeleton** — pnpm + Turborepo, `tsconfig.base.json`, `turbo.json`, the three
   workspace folders.
   - *Accept:* `pnpm install` runs clean; `pnpm -w build` builds empty packages without error.
3. **`packages/shared`** — implement §4.
   - *Accept:* `import { createSupabaseClient } from '@bbk/shared'` compiles; types exported.
4. **`packages/inngest`** — implement §5 (client, events, `order-paid` function).
   - *Accept:* `order-paid` compiles; inserting the same `webhookId` twice creates **one**
     `webhook_inbox` row and **one** `jobs` row (test against the dev DB or a mock).
5. **`supabase/migrations/0001_foundation.sql`** — author §3. **Do NOT run it** — output it for
   human review against the live schema.
   - *Accept:* SQL is idempotent (re-runnable); reviewer confirms it won't clobber existing
     `profiles`; only then is it run.
6. **`apps/trade` skeleton** — implement §6 + `api/inngest.ts` with HMAC verify.
   - *Accept:* `pnpm --filter @bbk/trade dev` serves; Google sign-in works against the shared
     Supabase; a signed-in admin/staff sees the (empty) jobs list; a `user` does not.
7. **End-to-end webhook check** — send a test `orders/paid` (Inngest dev server).
   - *Accept:* valid HMAC → one `jobs` row + `job/created` emitted; bad HMAC → 401; duplicate
     `webhookId` → no second row.

---

## 9. Sonnet-ready execution brief (paste into Cursor B)

> Paste these one at a time into the Cursor agent in **Account B**, letting each finish. They
> reference the sections above; keep this document open in the same workspace.

**Prompt 1 — house rules**
> "Create `AGENTS.md` for a brand-new monorepo `bbk-monorepo`. Rules: this repo is separate from
> the planner repo and they only talk via Supabase + Shopify webhooks, never shared files; stack is
> pnpm + Turborepo + Vite + TypeScript; it reuses the planner's existing Supabase project (new
> tables only, reuse `profiles` if present); every table has a `tenant_id` defaulting to a single
> `bbk` tenant; RLS is mandatory; webhook handling uses Inngest; the Supabase service-role key is
> server-only; database schema/RLS must be reviewed by a human before running. Then show me the file."

**Prompt 2 — skeleton**
> "Set up the monorepo skeleton per the structure in `P2-MONOREPO-BRIEF.md` §2: pnpm + Turborepo,
> `tsconfig.base.json`, `turbo.json`, and the three workspaces `packages/shared`, `packages/inngest`,
> `apps/trade` (Vite + TS). No business logic. Run `pnpm install` and confirm it's clean."

**Prompt 3 — shared package**
> "Implement `packages/shared` exactly per `P2-MONOREPO-BRIEF.md` §4 (Supabase client factory, Google
> OAuth auth wrapper modelled on the planner's `auth.js` which I'll paste, role helpers, and types).
> Read config from arguments/env passed in by the consumer — never read process.env inside the
> package. I'll paste `auth.js` now."  *(then paste auth.js)*

**Prompt 4 — inngest package**
> "Implement `packages/inngest` per `P2-MONOREPO-BRIEF.md` §5: the client, the typed event vocabulary
> (implement `shopify/order.paid` and `job/created`; only document the P4-reserved events), and the
> `order-paid` function with the exact behaviour listed (dedup via `webhook_inbox` unique key, upsert
> a `jobs` row, emit `job/created`, use the service-role client)."

**Prompt 5 — migration (REVIEW ONLY)**
> "Create `supabase/migrations/0001_foundation.sql` exactly as in `P2-MONOREPO-BRIEF.md` §3. Do NOT
> run it. Output the SQL and a short note on what to check against the live Supabase schema (especially
> whether `profiles` and an `on_auth_user_created` trigger already exist)."

**Prompt 6 — trade app skeleton**
> "Build `apps/trade` per `P2-MONOREPO-BRIEF.md` §6: Google sign-in/out showing name + role, a
> read-only jobs list (admin/staff only), and `api/inngest.ts` that verifies the Shopify HMAC before
> sending the `shopify/order.paid` event. Use env vars from §7. Then run the dev server."

**Prompt 7 — commit**
> "Confirm the branch with `git branch --show-current`, then commit with a clear message and push."

> After Prompt 5, bring the SQL back here for review before it is run against the shared Supabase.
