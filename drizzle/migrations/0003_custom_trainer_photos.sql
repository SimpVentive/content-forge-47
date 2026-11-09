-- Option 2 custom trainers: five photos animated by ContentForge.
-- animation_mode chooses the option; photo_set lists the saved photo paths by slot.
-- Files live in the owner's private folder (custom-trainers/<user id>/<trainer id>/photos/).

ALTER TABLE public.custom_trainers
  ADD COLUMN IF NOT EXISTS animation_mode text NOT NULL DEFAULT 'video'
    CHECK (animation_mode IN ('video', 'photos')),
  ADD COLUMN IF NOT EXISTS photo_set jsonb NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL;
