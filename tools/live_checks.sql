-- READ-ONLY checks for the LIVE project. One statement, one JSON result, one key per block (block_1 ... block_17).
-- Only SELECT and catalogue lookups. Nothing is created, changed or deleted. Do not add statements that write.
-- Run it once in the SQL editor and copy the value of "result".

SELECT json_build_object(
  -- 1. qa_audit_select_admin: does it exist, and what rule does it use?
  'block_1', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT policyname, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'qa_audit_logs' AND policyname = 'qa_audit_select_admin') t),

  -- 2. Which is_admin functions exist (null = missing).
  'block_2', json_build_object(
     'public_is_admin', to_regprocedure('public.is_admin(uuid)')::text,
     'private_is_admin', to_regprocedure('private.is_admin(uuid)')::text),

  -- 3. Does user_assets exist (null = missing)?
  'block_3', json_build_object('user_assets', to_regclass('public.user_assets')::text),

  -- 4. user_assets columns.
  'block_4', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_assets'
     ORDER BY ordinal_position) t),

  -- 5. Indexes on the asset tables (idx_pref_created_at and idx_usage_log_used_at come from create_asset_tables.sql).
  'block_5', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('user_assets', 'asset_selection_preferences', 'asset_usage_log')
     ORDER BY tablename, indexname) t),

  -- 6. Foreign keys on the asset tables (course_id -> course_drafts comes from create_asset_tables.sql).
  'block_6', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE contype = 'f'
       AND conrelid IN (to_regclass('public.asset_selection_preferences'), to_regclass('public.asset_usage_log'))
     ORDER BY 1, 2) t),

  -- 7. The Harish row: id and name only.
  'block_7', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT id, name
     FROM public.custom_trainers
     WHERE name ILIKE '%harish%') t),

  -- 8. Which trainer columns from migration 20261115 exist yet (empty = not applied).
  'block_8', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'custom_trainers'
       AND column_name IN ('team_id', 'consent_recorded', 'consent_ref', 'base_clip_count', 'voice_settings')
     ORDER BY column_name) t),

  -- 9. Migration 9: the private schema exists.
  'block_9', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT nspname FROM pg_namespace WHERE nspname = 'private') t),

  -- 10. Migration 9: private.is_admin is SECURITY DEFINER, and public.is_admin is gone.
  'block_10', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT p.oid::regprocedure::text AS function, p.prosecdef AS security_definer, p.proconfig AS settings
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'is_admin' AND n.nspname IN ('public', 'private')) t),

  -- 11. Migration 9: policies that now use private.is_admin (expects nine, plus qa_audit_select_admin if fixed).
  'block_11', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT tablename, policyname
     FROM pg_policies
     WHERE qual LIKE '%private.is_admin%' OR with_check LIKE '%private.is_admin%'
     ORDER BY tablename, policyname) t),

  -- 12. Migration 9: policies that still call public.is_admin (expects none once migration 9 is applied).
  'block_12', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT tablename, policyname
     FROM pg_policies
     WHERE qual LIKE '%public.is_admin%' OR with_check LIKE '%public.is_admin%'
     ORDER BY tablename, policyname) t),

  -- 13. Migration 9: spend_credits exists (null = missing).
  'block_13', json_build_object('spend_credits', to_regprocedure('public.spend_credits(uuid,integer,text)')::text),

  -- 14. Migration 9: who may run spend_credits (expects anon false, authenticated false, service_role true).
  'block_14', CASE WHEN to_regprocedure('public.spend_credits(uuid,integer,text)') IS NULL THEN NULL ELSE json_build_object(
     'anon', has_function_privilege('anon', 'public.spend_credits(uuid,integer,text)', 'EXECUTE'),
     'authenticated', has_function_privilege('authenticated', 'public.spend_credits(uuid,integer,text)', 'EXECUTE'),
     'service_role', has_function_privilege('service_role', 'public.spend_credits(uuid,integer,text)', 'EXECUTE')) END,

  -- 15. Migration 9: direct execute of handle_new_user is revoked (expects anon false, authenticated false).
  'block_15', CASE WHEN to_regprocedure('public.handle_new_user()') IS NULL THEN NULL ELSE json_build_object(
     'anon', has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
     'authenticated', has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')) END,

  -- 16. Migration 9: the self-role-change trigger on profiles (expects one row).
  'block_16', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT tgname FROM pg_trigger
     WHERE tgname = 'profiles_prevent_self_role_change' AND NOT tgisinternal) t),

  -- 17. Migration 9: touch_updated_at has a fixed search path (expects search_path=public in settings).
  'block_17', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
     SELECT proname, proconfig FROM pg_proc WHERE proname = 'touch_updated_at') t)
) AS result;
