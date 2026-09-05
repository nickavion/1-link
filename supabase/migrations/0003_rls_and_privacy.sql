-- Section 4 of the outline: RLS for the new table, plus two gaps in the
-- inherited policies from 0001.

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Preferences: strictly private, no exceptions. There is deliberately no public
-- SELECT policy, so an anonymous or mismatched JWT sees zero rows — not a
-- filtered subset.
DROP POLICY IF EXISTS "users manage own preferences only" ON user_preferences;
CREATE POLICY "users manage own preferences only"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Two inherited UPDATE policies have a USING clause but no WITH CHECK. USING
-- decides which rows you may update; WITH CHECK decides what they may look like
-- afterwards. Without it, the owner of a row can update it and hand ownership
-- to someone else (events.user_id) or reassign an RSVP to another account
-- (attendees.user_id) — the row passes USING on the way in and is unchecked on
-- the way out.
DROP POLICY IF EXISTS "Users can update their own events" ON events;
CREATE POLICY "Users can update their own events" ON events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own attendance" ON attendees;
CREATE POLICY "Users can update their own attendance" ON attendees
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public attendee counts.
-- Attendee rows are private (you see your own; the organiser sees all), so the
-- "N going" number on a public card cannot come from count(*) over attendees.
-- Keep a denormalised counter on events instead, maintained by a definer
-- trigger that may write a column the caller's own policies would refuse.
ALTER TABLE events ADD COLUMN IF NOT EXISTS going_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION sync_event_going_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID := COALESCE(NEW.event_id, OLD.event_id);
BEGIN
  UPDATE events e
     SET going_count = (
       SELECT COUNT(*) FROM attendees a
        WHERE a.event_id = target AND a.status = 'approved'
     )
   WHERE e.id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS attendees_sync_going_count ON attendees;
CREATE TRIGGER attendees_sync_going_count
  AFTER INSERT OR UPDATE OR DELETE ON attendees
  FOR EACH ROW EXECUTE FUNCTION sync_event_going_count();
