-- ============================================================
--  Brown Box Kit Planner — projects.project_code (cross-repo join key)
--
--  PURPOSE: give every planner project a stable, human-friendly code
--  (e.g. 'BBK-3F9A2C') that is stamped onto the Shopify cart as an
--  order attribute. The Trade monorepo maps that order attribute onto
--  jobs.project_code at intake, making the planner<->job link
--  resolvable from either app by reading the SHARED DB — never via
--  direct HTTP between codebases.
--
--  OWNERSHIP: public.projects is PLANNER-OWNED. The monorepo must not
--  alter this table; jobs.project_code (the receiving end) already
--  exists on their side. This column is ours.
--
--  HOW TO APPLY: paste into the Supabase SQL editor → Run.
--  Idempotent (safe to re-run).
-- ============================================================

alter table public.projects
  add column if not exists project_code text;

-- One code per project. NULLs allowed (legacy rows backfill lazily on
-- next open/save from the client); the partial unique index ignores them.
create unique index if not exists projects_project_code_key
  on public.projects (project_code)
  where project_code is not null;
