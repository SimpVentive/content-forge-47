-- Custom trainers: a person's own photo and voice (consent required).
-- Per-user for now. owner_org_id is reserved so an organisation can own trainers later.

CREATE TABLE IF NOT EXISTS public.custom_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_org_id uuid NULL,
  name text NOT NULL,
  photo_path text NULL,
  voice_sample_path text NULL,
  voice_id text NULL,
  voice_status text NOT NULL DEFAULT 'draft' CHECK (voice_status IN ('draft', 'processing', 'ready', 'failed')),
  voice_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.custom_trainer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.custom_trainers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_sentence text NOT NULL,
  consent_audio_path text NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NULL
);

ALTER TABLE public.custom_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_trainer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_trainers_select_own ON public.custom_trainers
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY custom_trainers_insert_own ON public.custom_trainers
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY custom_trainers_update_own ON public.custom_trainers
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY custom_trainer_consents_select_own ON public.custom_trainer_consents
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY custom_trainer_consents_insert_own ON public.custom_trainer_consents
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

-- Private bucket. Each file sits under <user id>/... so the policies can check the owner.
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-trainers', 'custom-trainers', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY custom_trainers_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'custom-trainers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY custom_trainers_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'custom-trainers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY custom_trainers_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'custom-trainers' AND (storage.foldername(name))[1] = auth.uid()::text);
