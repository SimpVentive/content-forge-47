
-- 1) Private schema for sensitive helper functions
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2) Move is_admin into private schema
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

-- 3) Update policies to use private.is_admin and drop public.is_admin
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS billing_tx_select_admin ON public.billing_transactions;
DROP POLICY IF EXISTS provider_configs_admin_all ON public.provider_configs;
DROP POLICY IF EXISTS conversations_select_admin ON public.conversations;
DROP POLICY IF EXISTS conversations_update_admin ON public.conversations;
DROP POLICY IF EXISTS rates_admin_all ON public.api_provider_rates;
DROP POLICY IF EXISTS usage_select_admin ON public.api_usage_logs;
DROP POLICY IF EXISTS purchases_admin_all ON public.provider_purchases;

CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY billing_tx_select_admin ON public.billing_transactions FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY provider_configs_admin_all ON public.provider_configs FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY conversations_select_admin ON public.conversations FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY conversations_update_admin ON public.conversations FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY rates_admin_all ON public.api_provider_rates FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY usage_select_admin ON public.api_usage_logs FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY purchases_admin_all ON public.provider_purchases FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 4) Lock down spend_credits: only callable by server (service_role)
REVOKE ALL ON FUNCTION public.spend_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, integer, text) TO service_role;

-- 5) handle_new_user is a trigger function; revoke direct execute privileges
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 6) Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 7) Prevent role escalation via profiles_update_self
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT private.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'permission denied: only admins can change role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_self_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_self_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();
