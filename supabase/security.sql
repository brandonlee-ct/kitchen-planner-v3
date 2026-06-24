-- ============================================================
--  ⚠️  HISTORICAL — DO NOT RE-RUN  ⚠️
--
--  This file was the planner's ORIGINAL security setup. The shared
--  Supabase project is now also used by the Trade monorepo, which
--  owns the canonical profiles schema + role set (see P2-MONOREPO-BRIEF.md).
--
--  Re-running this file would HARM the shared DB:
--    • Section 1's CHECK (role in ('user','staff','admin')) would
--      NARROW the role set and break every Trade role (hq_admin,
--      driver, pos, …). The live CHECK is now wider.
--    • Section 2's profiles_update_own has NO role pin, allowing
--      self-escalation to admin. The monorepo migration replaced it
--      with a hardened version that pins role. Do not revert it.
--
--  SOURCES OF TRUTH (apply these, NOT this file):
--    • profiles / roles / role CHECK  -> monorepo supabase/migrations
--    • planner admin access (projects) -> supabase/planner-admin-roles.sql
--
--  Kept only for history. Any shared-schema change is cross-repo and
--  human-reviewed — never re-applied unilaterally.
-- ============================================================
--
--  (original header below — for reference only)
--  Brown Box Kit Planner — Supabase Security Setup
--  Turns on Row Level Security (RLS) + admin/user roles.
--  Safe to run more than once (idempotent).
-- ============================================================


-- 1. PROFILES TABLE — one row per user, stores their role -----
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user'
                 check (role in ('user','staff','admin')),
  display_name text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who already exist
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
on conflict (id) do nothing;

-- Helper: is the current user an admin? (used by policies below)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- 2. PROFILES — Row Level Security --------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());


-- 3. PROJECTS — add columns for read-only share links -------------
alter table public.projects add column if not exists is_public  boolean not null default false;
alter table public.projects add column if not exists share_slug text unique;


-- 4. PROJECTS — Row Level Security (THE CRITICAL FIX) -------------
alter table public.projects enable row level security;

-- Owners (and admins) can read their projects
drop policy if exists "projects_select_own_or_admin" on public.projects;
create policy "projects_select_own_or_admin" on public.projects
  for select using (user_id = auth.uid() or public.is_admin());

-- Anyone can read a project that has been explicitly shared
drop policy if exists "projects_select_public" on public.projects;
create policy "projects_select_public" on public.projects
  for select using (is_public = true);

-- Users can only create projects under their own id
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());

-- Owners (and admins) can edit
drop policy if exists "projects_update_own_or_admin" on public.projects;
create policy "projects_update_own_or_admin" on public.projects
  for update using (user_id = auth.uid() or public.is_admin());

-- Owners (and admins) can delete
drop policy if exists "projects_delete_own_or_admin" on public.projects;
create policy "projects_delete_own_or_admin" on public.projects
  for delete using (user_id = auth.uid() or public.is_admin());


-- 5. STORAGE — thumbnails bucket (Task 1.9) ----------------------
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "thumbnails_public_read" on storage.objects;
create policy "thumbnails_public_read" on storage.objects
  for select using (bucket_id = 'thumbnails');

drop policy if exists "thumbnails_owner_insert" on storage.objects;
create policy "thumbnails_owner_insert" on storage.objects
  for insert with check (bucket_id = 'thumbnails' and owner = auth.uid());

drop policy if exists "thumbnails_owner_update" on storage.objects;
create policy "thumbnails_owner_update" on storage.objects
  for update using (bucket_id = 'thumbnails' and owner = auth.uid());

drop policy if exists "thumbnails_owner_delete" on storage.objects;
create policy "thumbnails_owner_delete" on storage.objects
  for delete using (bucket_id = 'thumbnails' and owner = auth.uid());


-- ============================================================
--  MAKE YOURSELF ADMIN  (run AFTER signing in at least once)
--  1. Find your user id:
--       select id, email from auth.users;
--  2. Copy your id and run (replace the placeholder):
--       update public.profiles set role = 'admin'
--       where id = '00000000-0000-0000-0000-000000000000';
--  Your trainee can stay 'user', or set role = 'staff' for them.
-- ============================================================
