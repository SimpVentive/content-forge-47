
-- api_provider_rates
CREATE TABLE public.api_provider_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  cost_per_unit NUMERIC(10, 6) NOT NULL,
  unit_description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_provider_rates TO authenticated;
GRANT ALL ON public.api_provider_rates TO service_role;
ALTER TABLE public.api_provider_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_select_authenticated" ON public.api_provider_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "rates_admin_all" ON public.api_provider_rates FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_api_provider_rates_updated BEFORE UPDATE ON public.api_provider_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- api_usage_logs
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  units_used INTEGER NOT NULL,
  cost NUMERIC(10, 6) NOT NULL,
  reason TEXT,
  course_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_usage_logs TO authenticated;
GRANT ALL ON public.api_usage_logs TO service_role;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_select_own" ON public.api_usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usage_select_admin" ON public.api_usage_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE INDEX idx_api_usage_user_id ON public.api_usage_logs(user_id);
CREATE INDEX idx_api_usage_provider ON public.api_usage_logs(provider_name);
CREATE INDEX idx_api_usage_created_at ON public.api_usage_logs(created_at);

-- provider_purchases
CREATE TABLE public.provider_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  units_purchased INTEGER NOT NULL,
  cost_inr NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.provider_purchases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_purchases TO authenticated;
ALTER TABLE public.provider_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_admin_all" ON public.provider_purchases FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX idx_provider_purchases_date ON public.provider_purchases(purchase_date);

-- Seed known providers
INSERT INTO public.api_provider_rates (provider_name, cost_per_unit, unit_description, notes) VALUES
  ('BFL (Flux 2)', 0.055, 'per image', 'Black Forest Labs image generation'),
  ('ElevenLabs', 0.0003, 'per character', 'Text-to-speech API'),
  ('HeyGen', 0.50, 'per minute video', 'Avatar video generation'),
  ('Anthropic Claude', 0.001, 'per 1K tokens', 'API cost for Claude calls')
ON CONFLICT (provider_name) DO NOTHING;
