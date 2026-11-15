-- THROWAWAY PROJECT ONLY. Never run this against the live project.
--
-- Gap found while applying the migrations: 20260630174031 (file 9) drops public.is_admin, but the policy
-- qa_audit_select_admin, created by 20260623000000_qa_audit_logs.sql, still depends on it, so the drop fails.
-- This step moves that one policy to private.is_admin before file 9 runs. It does the same thing file 9 does
-- for the private schema and function, so file 9 can run afterwards unchanged (it uses CREATE OR REPLACE).
-- The rule of the policy is the same as before: admins may select.
-- No file in supabase/migrations/ is changed by this.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "qa_audit_select_admin" ON public.qa_audit_logs;
CREATE POLICY "qa_audit_select_admin" ON public.qa_audit_logs
  FOR SELECT USING (private.is_admin(auth.uid()));
