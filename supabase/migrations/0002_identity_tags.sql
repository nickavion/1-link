-- Tags, cover image, and the private per-user preferences table.
-- Section 3 of the setup outline.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_tags   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS event_type_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vibe_tags       TEXT[] NOT NULL DEFAULT '{}';

-- GIN indexes so tag-filter queries stay fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_events_identity_tags   ON events USING GIN (identity_tags);
CREATE INDEX IF NOT EXISTS idx_events_event_type_tags ON events USING GIN (event_type_tags);
CREATE INDEX IF NOT EXISTS idx_events_vibe_tags       ON events USING GIN (vibe_tags);

-- Private per-user preferences — NEVER exposed publicly. Policies live in 0003.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The tag vocabulary is enforced in the database as well as in src/utils/tags.js.
-- Without this a hand-rolled REST call could write tags the filter UI will never
-- render, and they would be invisible in the product but present in the data.
CREATE OR REPLACE FUNCTION tags_are_subset(tags TEXT[], allowed TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT tags <@ allowed;
$$;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_identity_tags_valid;
ALTER TABLE events ADD CONSTRAINT events_identity_tags_valid CHECK (
  tags_are_subset(identity_tags, ARRAY[
    'trans_masc','trans_fem','sapphic','gay','lesbian','bi_pan',
    'nb','cis_women','cis_men','allies','all_welcome'
  ])
);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_tags_valid;
ALTER TABLE events ADD CONSTRAINT events_event_type_tags_valid CHECK (
  tags_are_subset(event_type_tags, ARRAY[
    'party','meetup','workshop','sports','art','dating_mixer','support_group'
  ])
);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_vibe_tags_valid;
ALTER TABLE events ADD CONSTRAINT events_vibe_tags_valid CHECK (
  tags_are_subset(vibe_tags, ARRAY[
    '18+','21+','free','ticketed','accessible_venue','alcohol_free'
  ])
);

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_identity_tags_valid;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_identity_tags_valid CHECK (
  tags_are_subset(identity_tags, ARRAY[
    'trans_masc','trans_fem','sapphic','gay','lesbian','bi_pan',
    'nb','cis_women','cis_men','allies','all_welcome'
  ])
);

-- Length limits to match the Zod schemas in src/utils/validation.js, so the cap
-- holds even for a caller that never loads the frontend.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_title_length;
ALTER TABLE events ADD CONSTRAINT events_title_length
  CHECK (char_length(title) BETWEEN 3 AND 120);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_description_length;
ALTER TABLE events ADD CONSTRAINT events_description_length
  CHECK (description IS NULL OR char_length(description) <= 4000);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_location_length;
ALTER TABLE events ADD CONSTRAINT events_location_length
  CHECK (location IS NULL OR char_length(location) <= 200);
