
CREATE TABLE public.user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assets TO authenticated;
GRANT ALL ON public.user_assets TO service_role;
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_can_read_own_assets" ON public.user_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_can_insert_own_assets" ON public.user_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_update_own_assets" ON public.user_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_can_delete_own_assets" ON public.user_assets FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.asset_selection_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  selected_asset_ids UUID[] DEFAULT '{}',
  course_type TEXT,
  topic_keywords TEXT[],
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_selection_preferences TO authenticated;
GRANT ALL ON public.asset_selection_preferences TO service_role;
ALTER TABLE public.asset_selection_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_prefs" ON public.asset_selection_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.asset_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.user_assets(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  slide_number INT NOT NULL,
  slide_title TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_usage_log TO authenticated;
GRANT ALL ON public.asset_usage_log TO service_role;
ALTER TABLE public.asset_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_insert_own_usage" ON public.asset_usage_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_read_own_usage" ON public.asset_usage_log FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_user_assets_user_id ON public.user_assets(user_id);
CREATE INDEX idx_user_assets_tags ON public.user_assets USING GIN(tags);
CREATE INDEX idx_pref_user_id ON public.asset_selection_preferences(user_id);
CREATE INDEX idx_pref_course_type ON public.asset_selection_preferences(user_id, course_type);
CREATE INDEX idx_usage_log_asset_id ON public.asset_usage_log(asset_id);
CREATE INDEX idx_usage_log_user_id ON public.asset_usage_log(user_id);
