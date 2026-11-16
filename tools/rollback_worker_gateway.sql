-- ROLLBACK for supabase/migrations/20261116120000_worker_gateway.sql.
-- NOT RUN ANYWHERE. Run it only on a project where that migration was applied, and only when you mean to remove it.
--
-- It removes ONLY what that migration creates:
--   function: claim_next_module_job(text)
--   table:    module_job_claims (its rows are operational: which job a worker holds, and a token hash)
--   column:   module_jobs.progress_at
--
-- It does not touch anything that existed before the migration. Every drop is IF EXISTS, and there is no CASCADE,
-- so an unexpected dependency makes the whole rollback fail (it runs in one transaction) rather than removing something else.
-- Jobs that are currently "generating" stay that way after the rollback. Their workers can't reach the gateway without the
-- claim function, so fail them by hand if needed.

BEGIN;

-- 1. The claim function first (the table does not depend on it, but keep the order obvious).
DROP FUNCTION IF EXISTS public.claim_next_module_job(text);

-- 2. The claim record table.
DROP TABLE IF EXISTS public.module_job_claims;

-- 3. The progress timestamp column on module_jobs.
ALTER TABLE public.module_jobs DROP COLUMN IF EXISTS progress_at;

COMMIT;
