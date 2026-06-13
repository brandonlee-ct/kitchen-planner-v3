-- ============================================================================
-- RLS VERIFICATION — Task Q launch gate (READ-ONLY)
-- ============================================================================
-- Paste into the Supabase SQL editor and Run. Every query is a SELECT; it
-- changes NOTHING. It only reports whether Row Level Security is protecting
-- customer data. Read the "WHAT GOOD LOOKS LIKE" note under each query.
--
-- The whole point: the anon key in auth.js is public. It is only safe if RLS
-- is ON and policies scope every row to its owner (auth.uid()). If RLS is OFF,
-- anyone with the public key can read every customer's saved kitchens.
-- ============================================================================


-- 1) Is RLS turned ON for the projects table? --------------------------------
select
  c.relname                 as table_name,
  c.relrowsecurity          as rls_enabled,     -- want: true
  c.relforcerowsecurity     as rls_forced       -- nice-to-have: true
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'projects';
-- WHAT GOOD LOOKS LIKE: one row, rls_enabled = true.
-- RED FLAG: rls_enabled = false  ->  DO NOT LAUNCH. Turn RLS on first.


-- 2) What policies exist on projects, and what do they scope to? -------------
select
  policyname,
  cmd                       as applies_to,      -- SELECT / INSERT / UPDATE / DELETE / ALL
  roles,
  qual                      as using_condition, -- the read/visibility rule
  with_check                as write_condition  -- the insert/update rule
from pg_policies
where schemaname = 'public'
  and tablename  = 'projects'
order by cmd, policyname;
-- WHAT GOOD LOOKS LIKE: owner policies whose condition references the user, e.g.
--   (auth.uid() = user_id)
-- on SELECT/INSERT/UPDATE/DELETE (or one ALL policy). For sharing, a SELECT
-- policy that also allows  is_public = true  is expected (so loadPublicProject
-- can read shared rows) — but it must NOT expose private rows.
-- RED FLAGS:
--   * No rows at all  -> RLS on but no policy = either nobody can read, or (if a
--     permissive default exists) everybody can. Investigate before launch.
--   * A condition of just  true  on SELECT -> every row is world-readable. BAD.
--   * roles shows 'anon'/'public' with an unrestricted condition. BAD.


-- 3) The thumbnails storage bucket — is it as intended? ----------------------
select id, name, public
from storage.buckets
where id = 'thumbnails';
-- WHAT GOOD LOOKS LIKE: one row. public = true is acceptable ONLY because
-- thumbnails are non-sensitive preview images (auth.js stores them at
-- ${user.id}/<uuid>.png and saves the public URL). If you consider thumbnails
-- private, set public = false and serve via signed URLs instead.


-- 4) Storage write policies — can a user only write to THEIR folder? ---------
select
  policyname,
  cmd                       as applies_to,
  roles,
  qual                      as using_condition,
  with_check                as write_condition
from pg_policies
where schemaname = 'storage'
  and tablename  = 'objects'
order by cmd, policyname;
-- WHAT GOOD LOOKS LIKE: write policies (INSERT/UPDATE) for the thumbnails bucket
-- that pin the upload to the user's own folder, e.g.
--   bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text
-- RED FLAG: an INSERT/UPDATE policy on the thumbnails bucket with condition
--   true  (any signed-in user could overwrite anyone's thumbnails). BAD.


-- 5) Sanity: list every table in public that has RLS OFF ---------------------
--    (catches any other customer-data table that was missed)
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'           -- ordinary tables only
  and c.relrowsecurity = false
order by c.relname;
-- WHAT GOOD LOOKS LIKE: zero rows (every public table has RLS on), OR only
-- tables that hold no user data. RED FLAG: any table holding customer data
-- (projects, future analytics_events, etc.) appearing here.
