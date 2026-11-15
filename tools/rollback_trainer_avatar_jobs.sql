-- ROLLBACK for supabase/migrations/20261115120000_trainer_avatar_jobs.sql.
-- NOT RUN ANYWHERE. Review it, then run it only on a project where that migration was applied and you mean to remove it.
--
-- It removes ONLY what that migration creates:
--   tables:     module_job_events, module_jobs, team_members, teams
--   columns:    custom_trainers.team_id, custom_trainers.base_clip_count, custom_trainers.voice_settings
--   functions:  trainer_has_consent(uuid), guard_trainer_privileged_columns(), module_jobs_touch_updated_at(),
--               team_role(uuid), is_team_member(uuid)
--   triggers:   custom_trainers_guard_privileged, module_jobs_touch_updated_at
--   indexes:    module_jobs_status_created_idx, module_jobs_team_idx, module_job_events_job_idx
--   policies:   teams_select_member, team_members_select_member, custom_trainers_select_team,
--               module_jobs_select_team, module_job_events_select_team,
--               trainer_clips_owner_select, trainer_clips_owner_insert, trainer_clips_owner_update, trainer_clips_owner_delete
--   buckets:    trainer-clips, generated-videos, module-cache (checked to be empty; deleted by hand in the Storage screen)
--
-- It does NOT touch anything that existed before the migration: custom_trainers' other columns, the existing
-- custom_trainer_consents table (migration 20261108120000), the custom-trainers bucket, or any other policy,
-- function, table or bucket. Every drop is IF EXISTS, and there is no CASCADE, so an unexpected dependency makes the
-- whole rollback fail (it runs in one transaction) rather than removing something else.
--
-- It refuses to run if the feature holds data (teams, memberships, jobs, or trainers with a team, clip count or
-- voice settings). Those rows would be lost. Export them first. To run it anyway, delete the preflight block on purpose.
-- Buckets are not deleted by this script. It checks they are empty, then prints a notice to delete each one by hand.
-- The rollback stops if a bucket still holds files.

BEGIN;

-- 0. Preflight: refuse if there is data the rollback would delete.
DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.teams') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.teams' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rollback stopped: public.teams has % row(s). Export them first.', n; END IF;
  END IF;
  IF to_regclass('public.team_members') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.team_members' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rollback stopped: public.team_members has % row(s). Export them first.', n; END IF;
  END IF;
  IF to_regclass('public.module_jobs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.module_jobs' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rollback stopped: public.module_jobs has % row(s). Export them first.', n; END IF;
  END IF;
  IF to_regclass('public.module_job_events') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.module_job_events' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rollback stopped: public.module_job_events has % row(s). Export them first.', n; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'custom_trainers' AND column_name = 'team_id') THEN
    EXECUTE 'SELECT count(*) FROM public.custom_trainers
             WHERE team_id IS NOT NULL OR base_clip_count <> 0 OR voice_settings IS NOT NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rollback stopped: % trainer(s) have a team, clip count or voice settings. Export them first.', n; END IF;
  END IF;
END $$;

-- 1. Policies (before the functions and columns they use).
DROP POLICY IF EXISTS trainer_clips_owner_delete ON storage.objects;
DROP POLICY IF EXISTS trainer_clips_owner_update ON storage.objects;
DROP POLICY IF EXISTS trainer_clips_owner_insert ON storage.objects;
DROP POLICY IF EXISTS trainer_clips_owner_select ON storage.objects;
DROP POLICY IF EXISTS module_job_events_select_team ON public.module_job_events;
DROP POLICY IF EXISTS module_jobs_select_team ON public.module_jobs;
DROP POLICY IF EXISTS custom_trainers_select_team ON public.custom_trainers;
DROP POLICY IF EXISTS team_members_select_member ON public.team_members;
DROP POLICY IF EXISTS teams_select_member ON public.teams;

-- 2. Triggers.
DROP TRIGGER IF EXISTS module_jobs_touch_updated_at ON public.module_jobs;
DROP TRIGGER IF EXISTS custom_trainers_guard_privileged ON public.custom_trainers;

-- 3. Indexes (dropping the tables would remove them too; listed for the record).
DROP INDEX IF EXISTS public.module_job_events_job_idx;
DROP INDEX IF EXISTS public.module_jobs_team_idx;
DROP INDEX IF EXISTS public.module_jobs_status_created_idx;

-- 4. Job and membership tables, children first.
DROP TABLE IF EXISTS public.module_job_events;
DROP TABLE IF EXISTS public.module_jobs;
DROP TABLE IF EXISTS public.team_members;

-- 5. Columns the migration added to custom_trainers (team_id carries the foreign key to teams).
ALTER TABLE public.custom_trainers DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.custom_trainers DROP COLUMN IF EXISTS base_clip_count;
ALTER TABLE public.custom_trainers DROP COLUMN IF EXISTS voice_settings;

-- 6. The teams table.
DROP TABLE IF EXISTS public.teams;

-- 7. Functions. trainer_has_consent first, because it calls is_team_member.
DROP FUNCTION IF EXISTS public.trainer_has_consent(uuid);
DROP FUNCTION IF EXISTS public.guard_trainer_privileged_columns();
DROP FUNCTION IF EXISTS public.module_jobs_touch_updated_at();
DROP FUNCTION IF EXISTS public.team_role(uuid);
DROP FUNCTION IF EXISTS public.is_team_member(uuid);

-- 8. Buckets. This script does not delete them. It checks that each one is empty, then tells you to delete it
-- from the Storage screen. It stops the whole rollback if a bucket still holds files.
DO $$
DECLARE
  b text;
  n bigint;
BEGIN
  FOREACH b IN ARRAY ARRAY['trainer-clips', 'generated-videos', 'module-cache'] LOOP
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = b;
    IF n > 0 THEN
      RAISE EXCEPTION 'Rollback stopped: bucket % still holds % file(s). Export or delete them first.', b, n;
    END IF;
    RAISE NOTICE 'Bucket % is empty. Delete it from the Storage screen of the Supabase dashboard (this script does not delete buckets).', b;
  END LOOP;
END $$;

-- Only if the first draft of this migration was applied (the throwaway project; live never had it).
-- That draft added two consent columns. The current migration does not, so this is not part of the rollback above.
-- ALTER TABLE public.custom_trainers DROP COLUMN IF EXISTS consent_recorded, DROP COLUMN IF EXISTS consent_ref;

COMMIT;
