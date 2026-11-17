-- READ-ONLY checks for the worker gateway migration (20261116120000_worker_gateway.sql).
-- One statement, one JSON result. Only SELECT and catalogue lookups. Nothing is created, changed or deleted.
-- Run it in the SQL editor and copy the value of "result".

SELECT json_build_object(
  -- 1. The claim record table: exists, row-level security on, no policies, no browser access.
  'block_1', CASE WHEN to_regclass('public.module_job_claims') IS NULL THEN NULL ELSE json_build_object(
     'exists', true,
     'rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.module_job_claims')),
     'policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'module_job_claims'),
     'anon_can_select', has_table_privilege('anon', 'public.module_job_claims', 'SELECT'),
     'authenticated_can_select', has_table_privilege('authenticated', 'public.module_job_claims', 'SELECT'),
     'service_role_can_select', has_table_privilege('service_role', 'public.module_job_claims', 'SELECT')) END,

  -- 2. The claim function: exists, SECURITY DEFINER, fixed search path, only the service role may run it.
  'block_2', CASE WHEN to_regprocedure('public.claim_next_module_job(text)') IS NULL THEN NULL ELSE json_build_object(
     'exists', true,
     'security_definer', (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.claim_next_module_job(text)')),
     'settings', (SELECT proconfig FROM pg_proc WHERE oid = to_regprocedure('public.claim_next_module_job(text)')),
     'anon_can_execute', has_function_privilege('anon', 'public.claim_next_module_job(text)', 'EXECUTE'),
     'authenticated_can_execute', has_function_privilege('authenticated', 'public.claim_next_module_job(text)', 'EXECUTE'),
     'service_role_can_execute', has_function_privilege('service_role', 'public.claim_next_module_job(text)', 'EXECUTE')) END,

  -- 3. The progress timestamp column on module_jobs.
  'block_3', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'module_jobs' AND column_name = 'progress_at') t)
) AS result;
