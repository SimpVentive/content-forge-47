-- Trainer avatar module jobs: teams, team members, job queue, consent flags, guards and storage buckets.
--
-- ADDITIVE ONLY. This migration creates new tables, columns, functions, triggers, indexes, policies and buckets.
-- It does not alter, rename, or delete any existing table, column, or function.
-- Each policy below has a DROP POLICY IF EXISTS first. The names are new, so the drop only ever removes
-- a policy this migration created on an earlier run.
-- Not applied to any shared project yet: for review only.

-- 1. Teams and membership -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('creator', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Membership helpers. They run as the owner of the function, so they read team_members without
-- going through its policies. That is what stops the policies from recursing into each other.
-- SET search_path pins name resolution, so a caller cannot redirect the lookup to another schema.
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.team_id = p_team_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.team_role(p_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role FROM public.team_members m
  WHERE m.team_id = p_team_id AND m.user_id = auth.uid()
  LIMIT 1;
$$;

-- Only signed-in users may run the helpers. Anonymous and public roles may not.
-- REVOKE FROM PUBLIC alone does not remove a direct grant to anon, so anon is revoked by name.
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.team_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.team_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_role(uuid) TO authenticated;

-- Members can read their teams. Nothing else in the app writes to these tables from the browser.
DROP POLICY IF EXISTS teams_select_member ON public.teams;
CREATE POLICY teams_select_member ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_team_member(teams.id));

-- A user sees their own membership rows, and the rows of teams they belong to. No direct read of team_members
-- inside its own policy: the helper function does that work.
DROP POLICY IF EXISTS team_members_select_member ON public.team_members;
CREATE POLICY team_members_select_member ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_members.team_id));

-- 2. Team on trainers (new columns only) -------------------------------------------------
-- Consent is not a column here. It lives in custom_trainer_consents (migration 20261108120000), and
-- trainer_has_consent() below reads it.

ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS team_id uuid NULL REFERENCES public.teams(id) ON DELETE SET NULL;
-- Number of base clips in storage. Written by the server only (trainer-clips-sync).
ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS base_clip_count integer NOT NULL DEFAULT 0;
-- Voice settings for generation (set in the Trainer setup screen). NULL means the approved defaults are used.
ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS voice_settings jsonb NULL;

-- Guard: browser users cannot change the team or the clip count, on insert or update.
-- auth.role() reads the role from the request's JWT. The service role's key has role 'service_role', so
-- the first check lets the server through. A direct connection with no JWT gets NULL, which is also let through,
-- so only 'authenticated' and 'anon' callers are refused.
CREATE OR REPLACE FUNCTION public.guard_trainer_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller text := COALESCE(auth.role(), '');
  privileged_changed boolean;
BEGIN
  IF caller NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    privileged_changed := NEW.team_id IS NOT NULL OR NEW.base_clip_count <> 0;
  ELSE
    privileged_changed := NEW.team_id IS DISTINCT FROM OLD.team_id
      OR NEW.base_clip_count IS DISTINCT FROM OLD.base_clip_count;
  END IF;
  IF privileged_changed THEN
    RAISE EXCEPTION 'Team and clip count can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_trainers_guard_privileged ON public.custom_trainers;
CREATE TRIGGER custom_trainers_guard_privileged
  BEFORE INSERT OR UPDATE ON public.custom_trainers
  FOR EACH ROW EXECUTE FUNCTION public.guard_trainer_privileged_columns();

-- Consent for a trainer, read from custom_trainer_consents (the existing consent record).
-- It counts only when there is a recording (consent_audio_path), the owner's row matches the trainer's owner,
-- and the trainer is not deleted. Used by the app (through RPC) for the owner and team members.
-- The worker and module-job-create run with the service role, where auth.uid() is empty, so they read the table
-- directly with the same conditions.
CREATE OR REPLACE FUNCTION public.trainer_has_consent(p_trainer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.custom_trainers t
    JOIN public.custom_trainer_consents c
      ON c.trainer_id = t.id AND c.owner_user_id = t.owner_user_id
    WHERE t.id = p_trainer_id
      AND t.deleted_at IS NULL
      AND c.consent_audio_path IS NOT NULL
      AND (t.owner_user_id = auth.uid() OR public.is_team_member(t.team_id))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.trainer_has_consent(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trainer_has_consent(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.trainer_has_consent(uuid) TO authenticated;

-- Team members can read the trainers of their team.
DROP POLICY IF EXISTS custom_trainers_select_team ON public.custom_trainers;
CREATE POLICY custom_trainers_select_team ON public.custom_trainers
  FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(custom_trainers.team_id));

-- 3. Module jobs ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.module_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES public.custom_trainers(id) ON DELETE CASCADE,
  script_text text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'ready_for_review', 'failed', 'published', 'rejected')),
  progress text NULL,
  error text NULL,
  estimate_usd numeric(10, 2) NOT NULL DEFAULT 0,
  cost_usd numeric(10, 2) NULL,
  output_path text NULL,
  proof_path text NULL,
  report_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NULL,
  published_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.module_job_events (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.module_jobs(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_job_events ENABLE ROW LEVEL SECURITY;

-- Indexes for the queue and for team listings.
CREATE INDEX IF NOT EXISTS module_jobs_status_created_idx ON public.module_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS module_jobs_team_idx ON public.module_jobs (team_id);
CREATE INDEX IF NOT EXISTS module_job_events_job_idx ON public.module_job_events (job_id);

-- updated_at is set by the database on every change to a job.
CREATE OR REPLACE FUNCTION public.module_jobs_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS module_jobs_touch_updated_at ON public.module_jobs;
CREATE TRIGGER module_jobs_touch_updated_at
  BEFORE UPDATE ON public.module_jobs
  FOR EACH ROW EXECUTE FUNCTION public.module_jobs_touch_updated_at();

-- Team members read the team's jobs. There is no insert policy: jobs are created only by the
-- module-job-create edge function, with the service role. Updates (status, review) also come from the server.
DROP POLICY IF EXISTS module_jobs_select_team ON public.module_jobs;
CREATE POLICY module_jobs_select_team ON public.module_jobs
  FOR SELECT TO authenticated
  USING (public.is_team_member(module_jobs.team_id));

-- Events are visible to the team. Written by the server only.
DROP POLICY IF EXISTS module_job_events_select_team ON public.module_job_events;
CREATE POLICY module_job_events_select_team ON public.module_job_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.module_jobs j
    WHERE j.id = module_job_events.job_id AND public.is_team_member(j.team_id)
  ));

-- 4. Storage buckets (private) ---------------------------------------------------------
-- trainer-clips: base clips per trainer (owner uploads; the server counts them).
-- module-cache: cached pieces per trainer (worker only, no user policies).
-- generated-videos: final and proof videos and run reports, per job (server writes; reviewers get signed URLs).
-- Access is through the server (service role) and short-lived signed URLs. No public access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-clips', 'trainer-clips', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-videos', 'generated-videos', false)
ON CONFLICT (id) DO NOTHING;

-- module-cache: finished pieces, so a re-run does not pay again. Written only by the worker (service role).
-- It has NO storage policies, so browser users cannot read, write or overwrite it.
INSERT INTO storage.buckets (id, name, public)
VALUES ('module-cache', 'module-cache', false)
ON CONFLICT (id) DO NOTHING;

-- Storage access for the owner's own trainer folder only: <owner_user_id>/<trainer_id>/...
-- These policies do not read team_members.
DROP POLICY IF EXISTS trainer_clips_owner_select ON storage.objects;
CREATE POLICY trainer_clips_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'trainer-clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS trainer_clips_owner_insert ON storage.objects;
CREATE POLICY trainer_clips_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trainer-clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS trainer_clips_owner_update ON storage.objects;
CREATE POLICY trainer_clips_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'trainer-clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS trainer_clips_owner_delete ON storage.objects;
CREATE POLICY trainer_clips_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'trainer-clips' AND (storage.foldername(name))[1] = auth.uid()::text);
