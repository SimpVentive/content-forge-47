-- Talking-photo videos for custom trainers. One row per distinct clip: the same voice, photo and text
-- always give the same clip_hash, so an unchanged clip is never generated twice.

CREATE TABLE IF NOT EXISTS public.custom_trainer_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.custom_trainers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_hash text NOT NULL,
  kind text NOT NULL DEFAULT 'course' CHECK (kind IN ('sample', 'course')),
  text_preview text NULL,
  est_seconds numeric NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  heygen_video_id text NULL,
  audio_path text NULL,
  video_path text NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, clip_hash)
);

ALTER TABLE public.custom_trainer_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_trainer_clips_select_own ON public.custom_trainer_clips
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY custom_trainer_clips_insert_own ON public.custom_trainer_clips
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY custom_trainer_clips_update_own ON public.custom_trainer_clips
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
