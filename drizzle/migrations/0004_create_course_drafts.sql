CREATE TABLE public.course_drafts (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled Course',
  input_text text NOT NULL DEFAULT '',
  course_params jsonb,
  workflow_clips jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_drafts TO authenticated;
GRANT ALL ON public.course_drafts TO service_role;

ALTER TABLE public.course_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their courses" ON public.course_drafts
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owners can add their courses" ON public.course_drafts
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners can update their courses" ON public.course_drafts
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners can delete their courses" ON public.course_drafts
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE INDEX course_drafts_owner_saved_idx ON public.course_drafts (owner_user_id, saved_at DESC);