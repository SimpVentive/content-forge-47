-- READ-ONLY checks for the LIVE project. Run each block in the SQL editor on its own.
-- Every statement here is a SELECT or a catalogue lookup. Nothing is created, changed or deleted.
-- Do not add statements to this file that write to the database.

-- 1. qa_audit_select_admin: does it exist, and which is_admin function does it call?
--    Expected if the gap in migration 9 is still there: qual mentions public.is_admin.
--    Expected after migration 9 (or a fix): qual mentions private.is_admin.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'qa_audit_logs' AND policyname = 'qa_audit_select_admin';

SELECT to_regprocedure('public.is_admin(uuid)')  AS public_is_admin,   -- NULL means it has been dropped
       to_regprocedure('private.is_admin(uuid)') AS private_is_admin;  -- NULL means it has not been created

-- 2. user_assets: does the table exist, and what are its columns?
SELECT to_regclass('public.user_assets') AS user_assets;               -- NULL means it does not exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_assets'
ORDER BY ordinal_position;

-- 3. create_asset_tables.sql: its extra indexes and foreign keys (the other file does not have these).
--    Extra indexes to look for: idx_pref_created_at and idx_usage_log_used_at.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('user_assets', 'asset_selection_preferences', 'asset_usage_log')
ORDER BY tablename, indexname;

--    Foreign keys. The extra ones are course_id -> course_drafts(id) on both tables.
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid IN (to_regclass('public.asset_selection_preferences'), to_regclass('public.asset_usage_log'))
ORDER BY 1, 2;

-- 4. The Harish row. Shows every column of matching rows, whatever the migration state.
SELECT *
FROM public.custom_trainers
WHERE name ILIKE '%harish%';

--    Which of the trainer columns from migration 20261115 exist yet (empty result = not applied)?
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_trainers'
  AND column_name IN ('team_id', 'consent_recorded', 'consent_ref', 'base_clip_count', 'voice_settings')
ORDER BY column_name;

-- 5. Migration 9 (20260630174031): is each change present?

--    a. The private schema exists.
SELECT nspname FROM pg_namespace WHERE nspname = 'private';

--    b. private.is_admin is SECURITY DEFINER, and public.is_admin is gone.
SELECT p.oid::regprocedure AS function, p.prosecdef AS security_definer, p.proconfig AS settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_admin' AND n.nspname IN ('public', 'private');

--    c. Policies that now use private.is_admin (migration 9 expects nine, plus qa_audit_select_admin if fixed).
SELECT tablename, policyname
FROM pg_policies
WHERE qual LIKE '%private.is_admin%' OR with_check LIKE '%private.is_admin%'
ORDER BY tablename, policyname;

--    d. Policies that still call public.is_admin (expected: none once migration 9 is applied).
SELECT tablename, policyname
FROM pg_policies
WHERE qual LIKE '%public.is_admin%' OR with_check LIKE '%public.is_admin%'
ORDER BY tablename, policyname;

--    e. spend_credits: only service_role may run it (expected: false, false, true).
SELECT to_regprocedure('public.spend_credits(uuid,integer,text)') AS spend_credits_exists;
SELECT has_function_privilege('anon', 'public.spend_credits(uuid,integer,text)', 'EXECUTE')          AS anon_can,
       has_function_privilege('authenticated', 'public.spend_credits(uuid,integer,text)', 'EXECUTE') AS authenticated_can,
       has_function_privilege('service_role', 'public.spend_credits(uuid,integer,text)', 'EXECUTE')  AS service_role_can;

--    f. handle_new_user: direct execute is revoked from anon and authenticated (expected: false, false).
SELECT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')          AS anon_can,
       has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') AS authenticated_can;

--    g. The self-role-change trigger on profiles (expected: one row).
SELECT tgname FROM pg_trigger WHERE tgname = 'profiles_prevent_self_role_change' AND NOT tgisinternal;

--    h. touch_updated_at has a fixed search_path (expected: settings contains search_path=public).
SELECT proname, proconfig FROM pg_proc WHERE proname = 'touch_updated_at';
