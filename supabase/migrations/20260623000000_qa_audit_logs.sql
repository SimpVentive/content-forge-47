-- qa_audit_logs table to track QA changes for learning feedback

CREATE TABLE public.qa_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_draft_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT,
  topic TEXT,

  -- Issues found
  issues_found JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Corrections applied
  corrections_applied JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Severity level
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),

  -- Whether user accepted the fixes
  was_accepted_by_user BOOLEAN NOT NULL DEFAULT false,

  -- Before/after diffs for learning
  before_output JSONB,
  after_output JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.qa_audit_logs TO authenticated;
GRANT ALL ON public.qa_audit_logs TO service_role;

ALTER TABLE public.qa_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_audit_select_own" ON public.qa_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "qa_audit_select_admin" ON public.qa_audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "qa_audit_insert_own" ON public.qa_audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qa_audit_update_own" ON public.qa_audit_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_qa_audit_user_id ON public.qa_audit_logs(user_id);
CREATE INDEX idx_qa_audit_draft_id ON public.qa_audit_logs(course_draft_id);
CREATE INDEX idx_qa_audit_created_at ON public.qa_audit_logs(created_at);
CREATE INDEX idx_qa_audit_domain ON public.qa_audit_logs(domain);

CREATE TRIGGER trg_qa_audit_logs_updated BEFORE UPDATE ON public.qa_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
