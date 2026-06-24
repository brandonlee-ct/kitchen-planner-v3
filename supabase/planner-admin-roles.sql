-- ============================================================
--  Brown Box Kit Planner — Planner Admin Roles (RLS)
--
--  PURPOSE: Restrict ADMIN access to PLANNER-OWNED data
--  (public.projects) to the admin tier ONLY:
--      super_admin, hq_admin, admin
--  Every other shared/Trade role (sales, driver, pos, contractor,
--  accountant, logistics_manager, project_manager, area_admin,
--  client, plus legacy staff/installer/user) gets NO access to
--  other users' projects. Owners always manage their own rows.
--
--  WHY all three: per the monorepo, "super admin" is being
--  formalized as a distinct tier ABOVE hq_admin, but it does NOT
--  exist in the shared role CHECK yet. The current owner is stored
--  as hq_admin/admin TODAY. Matching all three keeps the owner's
--  planner-admin working before AND after the super_admin migration.
--  (super_admin inherits hq_admin authority on the Trade side.)
--
--  SHARED-DB SAFETY (this is one Supabase project shared with the
--  Trade monorepo — see P2-MONOREPO-BRIEF.md):
--    • Does NOT modify the shared public.is_admin() function — the
--      Trade app relies on it for its own tables. We add a separate
--      public.planner_is_admin() instead.
--    • Does NOT alter public.profiles, the role CHECK, or the role set.
--    • Touches ONLY policies on public.projects (planner-owned).
--
--  CROSS-REPO NOTE (this file only READS roles, never adds them):
--    'hq_admin' and legacy 'admin' are already in the shared
--    public.profiles.role CHECK, so this file is SAFE TO APPLY NOW —
--    the current owner keeps planner-admin immediately.
--    'super_admin' is being ADDED to the shared CHECK by the monorepo
--    migration (human-reviewed; they will provide the SHA). Until it
--    lands, the super_admin branch simply matches nobody — no breakage.
--
--  HOW TO APPLY: paste into the Supabase SQL editor → Run.
--  Idempotent (safe to re-run).
-- ============================================================


-- 1. Planner-scoped admin check (separate from the shared is_admin) ----
--    SECURITY DEFINER so the policy can read profiles.role without
--    tripping over profiles' own RLS. Matches the admin tier only:
--    super_admin (future, above hq_admin), hq_admin, legacy admin.
create or replace function public.planner_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'hq_admin', 'admin')
  );
$$;


-- 2. Rewrite public.projects admin policies to use planner_is_admin() --
--    Owners always manage their own rows (user_id = auth.uid()).
--    Cross-user read/update/delete is granted to super_admin/hq_admin
--    ONLY. No other Trade role gains incidental access.

drop policy if exists "projects_select_own_or_admin" on public.projects;
create policy "projects_select_own_or_admin" on public.projects
  for select using (user_id = auth.uid() or public.planner_is_admin());

drop policy if exists "projects_update_own_or_admin" on public.projects;
create policy "projects_update_own_or_admin" on public.projects
  for update using (user_id = auth.uid() or public.planner_is_admin());

drop policy if exists "projects_delete_own_or_admin" on public.projects;
create policy "projects_delete_own_or_admin" on public.projects
  for delete using (user_id = auth.uid() or public.planner_is_admin());

-- Intentionally UNCHANGED (do not duplicate — already live):
--   projects_insert_own     -> with check (user_id = auth.uid())
--   projects_select_public  -> using (is_public = true)   [read-only shares]


-- ============================================================
--  VERIFY (optional, run after applying):
--    -- super_admin / hq_admin / admin -> true; every other role -> false
--    select public.planner_is_admin();
--    -- list the live projects policies
--    select polname, polcmd from pg_policy
--      where polrelid = 'public.projects'::regclass;
-- ============================================================
