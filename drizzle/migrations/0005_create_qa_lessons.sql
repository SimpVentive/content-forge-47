CREATE TABLE public.qa_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  lesson_key text NOT NULL,
  lesson text NOT NULL,
  category text NOT NULL DEFAULT 'completeness',
  section text NOT NULL DEFAULT 'overall',
  times_seen integer NOT NULL DEFAULT 1,
  times_confirmed integer NOT NULL DEFAULT 0,
  times_dismissed integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, lesson_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_lessons TO authenticated;
GRANT ALL ON public.qa_lessons TO service_role;

ALTER TABLE public.qa_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their QA lessons" ON public.qa_lessons
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners add their QA lessons" ON public.qa_lessons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners update their QA lessons" ON public.qa_lessons
  FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners delete their QA lessons" ON public.qa_lessons
  FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

CREATE INDEX qa_lessons_owner_rank_idx ON public.qa_lessons (owner_user_id, last_seen_at DESC);