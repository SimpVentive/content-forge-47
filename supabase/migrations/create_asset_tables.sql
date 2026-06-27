-- Asset System Migration
-- Creates tables for user assets (Objects), preferences, and usage tracking

BEGIN;

-- Main assets table
CREATE TABLE user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Context-aware preferences with course type matching
CREATE TABLE asset_selection_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES course_drafts(id) ON DELETE CASCADE,
  selected_asset_ids UUID[] DEFAULT '{}',
  course_type TEXT,
  topic_keywords TEXT[],
  content_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Asset usage tracking for analytics
CREATE TABLE asset_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  asset_id UUID NOT NULL REFERENCES user_assets(id),
  course_id UUID NOT NULL REFERENCES course_drafts(id),
  slide_number INT NOT NULL,
  slide_title TEXT,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX idx_user_assets_tags ON user_assets USING GIN(tags);
CREATE INDEX idx_pref_user_id ON asset_selection_preferences(user_id);
CREATE INDEX idx_pref_course_type ON asset_selection_preferences(user_id, course_type);
CREATE INDEX idx_pref_created_at ON asset_selection_preferences(user_id, created_at DESC);
CREATE INDEX idx_usage_log_asset_id ON asset_usage_log(asset_id);
CREATE INDEX idx_usage_log_user_id ON asset_usage_log(user_id);
CREATE INDEX idx_usage_log_used_at ON asset_usage_log(used_at DESC);

-- RLS Policies for multi-tenancy enforcement
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_selection_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can only read own assets
CREATE POLICY "users_can_read_own_assets"
ON user_assets
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only update own assets
CREATE POLICY "users_can_update_own_assets"
ON user_assets
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete own assets
CREATE POLICY "users_can_delete_own_assets"
ON user_assets
FOR DELETE
USING (auth.uid() = user_id);

-- Users can only insert their own assets
CREATE POLICY "users_can_insert_own_assets"
ON user_assets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Preferences policies
CREATE POLICY "users_can_manage_own_preferences"
ON asset_selection_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Usage log policies
CREATE POLICY "users_can_log_own_usage"
ON asset_usage_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_read_own_logs"
ON asset_usage_log
FOR SELECT
USING (auth.uid() = user_id);

COMMIT;
