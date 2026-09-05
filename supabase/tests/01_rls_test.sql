-- Section 4 of the setup outline: "Test this before building anything else. Log in as
-- two different test users and confirm user B can't read user A's user_preferences
-- row via the API, not just through the UI."
--
-- This is that test, run against the database rather than the UI: RLS is evaluated
-- for a non-owner role, so a policy gap fails here the same way it would in
-- production. Run it with scripts/test-rls.sh.

\set QUIET on
\set ON_ERROR_STOP on

GRANT USAGE ON SCHEMA public, storage TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON events, attendees, user_preferences, storage.objects TO app_user;

\set A '''11111111-1111-4111-8111-111111111111'''
\set B '''22222222-2222-4222-8222-222222222222'''
\set EV '''aaaaaaaa-0000-4000-8000-000000000001'''
\set EV_PRIVATE '''aaaaaaaa-0000-4000-8000-000000000002'''

TRUNCATE attendees, events, user_preferences, storage.objects CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (id, email) VALUES (:A, 'a@example.com'), (:B, 'b@example.com');

-- Seeded as the table owner, so the seed itself is not what is under test.
INSERT INTO events (id, title, start_date, end_date, user_id, is_public, event_type_tags) VALUES
  (:EV,         'A public event',  now() + interval '1 day', now() + interval '2 day', :A, true,  ARRAY['meetup']),
  (:EV_PRIVATE, 'A private event', now() + interval '1 day', now() + interval '2 day', :A, false, ARRAY['meetup']);
INSERT INTO user_preferences (user_id, identity_tags) VALUES (:A, ARRAY['trans_masc','nb']);

-- ---------------------------------------------------------------- assertions
CREATE OR REPLACE FUNCTION pg_temp.want(label TEXT, got BIGINT, expected BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  IF got = expected THEN RETURN format('PASS  %s', label);
  ELSE RETURN format('FAIL  %s (expected %s, got %s)', label, expected, got);
  END IF;
END $$;

-- Runs a statement that MUST be rejected. A policy that silently matches zero rows
-- counts as rejection for UPDATE/DELETE; an INSERT must actually raise.
CREATE OR REPLACE FUNCTION pg_temp.want_denied(label TEXT, statement TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  affected BIGINT;
BEGIN
  EXECUTE statement;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN RETURN format('PASS  %s (no rows affected)', label);
  END IF;
  RETURN format('FAIL  %s (statement succeeded, %s rows)', label, affected);
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RETURN format('PASS  %s (%s)', label, SQLERRM);
END $$;

SET ROLE app_user;
\set QUIET off
\pset tuples_only on
\pset border 0

\echo '-- user B --'
SET test.uid = '22222222-2222-4222-8222-222222222222';
SELECT pg_temp.want('B cannot read A''s preferences',      (SELECT count(*) FROM user_preferences WHERE user_id = :A), 0);
SELECT pg_temp.want('B''s unfiltered preference scan leaks nothing', (SELECT count(*) FROM user_preferences), 0);
SELECT pg_temp.want('B can read A''s public event',        (SELECT count(*) FROM events WHERE id = :EV), 1);
SELECT pg_temp.want('B cannot read A''s private event',    (SELECT count(*) FROM events WHERE id = :EV_PRIVATE), 0);
SELECT pg_temp.want_denied('B cannot write A''s preferences',
  format('INSERT INTO user_preferences (user_id, identity_tags) VALUES (%L, ARRAY[''gay''])', :A));
SELECT pg_temp.want_denied('B cannot edit A''s event',
  format('UPDATE events SET title = ''hijacked'' WHERE id = %L', :EV));
SELECT pg_temp.want_denied('B cannot RSVP on A''s behalf',
  format('INSERT INTO attendees (event_id, user_id, status) VALUES (%L, %L, ''approved'')', :EV, :A));
SELECT pg_temp.want_denied('B cannot upload into A''s image folder',
  format('INSERT INTO storage.objects (bucket_id, name) VALUES (''event-images'', %L)', :A || '/x.jpg'));

\echo ''
\echo '-- user A --'
SET test.uid = '11111111-1111-4111-8111-111111111111';
SELECT pg_temp.want('A can read their own preferences',    (SELECT count(*) FROM user_preferences WHERE user_id = :A), 1);
SELECT pg_temp.want_denied('A cannot hand their event to B (WITH CHECK)',
  format('UPDATE events SET user_id = %L WHERE id = %L', :B, :EV));
SELECT pg_temp.want_denied('A cannot write a tag outside the vocabulary',
  format('UPDATE events SET identity_tags = ARRAY[''not_a_real_tag''] WHERE id = %L', :EV));
SELECT pg_temp.want_denied('A cannot write a 2-character title',
  format('UPDATE events SET title = ''ab'' WHERE id = %L', :EV));

\echo ''
\echo '-- going_count trigger --'
SET test.uid = '22222222-2222-4222-8222-222222222222';
INSERT INTO attendees (event_id, user_id, status) VALUES (:EV, :B, 'approved');
SELECT pg_temp.want('going_count rises when B RSVPs',      (SELECT going_count FROM events WHERE id = :EV), 1);
UPDATE attendees SET status = 'rejected' WHERE user_id = :B;
SELECT pg_temp.want('going_count falls when B withdraws',  (SELECT going_count FROM events WHERE id = :EV), 0);

\echo ''
\echo '-- anonymous --'
SET test.uid = '';
SELECT pg_temp.want('anon reads no preferences',           (SELECT count(*) FROM user_preferences), 0);
SELECT pg_temp.want('anon reads public events',            (SELECT count(*) FROM events WHERE is_public), 1);
SELECT pg_temp.want('anon reads no private events',        (SELECT count(*) FROM events WHERE NOT is_public), 0);
SELECT pg_temp.want('anon reads no guest lists',           (SELECT count(*) FROM attendees), 0);

RESET ROLE;
