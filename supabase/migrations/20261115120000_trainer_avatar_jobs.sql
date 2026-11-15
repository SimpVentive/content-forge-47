-- Trainer avatar module jobs: teams, team members, job queue, consent flags and storage buckets.
--
-- ADDITIVE ONLY. This migration creates new tables, adds new columns, adds new policies and creates new buckets.
-- It does not alter, rename, or delete any existing table, column, policy or object.
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

-- A member can see their own teams and the members of those teams.
CREATE POLICY teams_select_member ON public.teams
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = teams.id AND m.user_id = auth.uid()));

CREATE POLICY team_members_select_member ON public.team_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = team_members.team_id AND m.user_id = auth.uid()));

-- 2. Team on trainers and consent flags (new columns only) -------------------------------

ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS team_id uuid NULL REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS consent_recorded boolean NOT NULL DEFAULT false;
ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS consent_ref text NULL;
-- Number of base clips uploaded for the trainer (set by the upload step). Generation needs at least one.
ALTER TABLE public.custom_trainers ADD COLUMN IF NOT EXISTS base_clip_count integer NOT NULL DEFAULT 0;

-- Teammates can read the trainers of their team (the existing owner policies are not changed).
CREATE POLICY custom_trainers_select_team ON public.custom_trainers
  FOR SELECT TO authenticated
  USING (
    team_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = custom_trainers.team_id AND m.user_id = auth.uid())
  );

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

-- Teammates see the team's jobs.
CREATE POLICY module_jobs_select_team ON public.module_jobs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = module_jobs.team_id AND m.user_id = auth.uid()));

-- Only creators and admins of the team can create a job, and only as themselves.
CREATE POLICY module_jobs_insert_creator ON public.module_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.team_id = module_jobs.team_id AND m.user_id = auth.uid() AND m.role IN ('creator', 'admin')
    )
  );

-- Events are visible to the team, written by the server only (service role bypasses RLS).
CREATE POLICY module_job_events_select_team ON public.module_job_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.module_jobs j
    JOIN public.team_members m ON m.team_id = j.team_id
    WHERE j.id = module_job_events.job_id AND m.user_id = auth.uid()
  ));

-- 4. Storage buckets (private) ---------------------------------------------------------
-- trainer-clips: voice.json, base clips and cached pieces, per trainer.
-- generated-videos: final and proof videos and run reports, per job.
-- Access is through the server (service role) and short-lived signed URLs. No public access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-clips', 'trainer-clips', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-videos', 'generated-videos', false)
ON CONFLICT (id) DO NOTHING;
