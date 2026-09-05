-- Minimal stand-ins for the Supabase-managed objects the migrations reference, so the
-- real migration files can be applied unmodified to a plain Postgres for testing.
-- Never run this against a Supabase project — it only exists for the local harness.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);

-- Supabase derives this from the request JWT; here a session GUC stands in, so a
-- test can switch users with SET test.uid.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY, name TEXT, public BOOLEAN,
  file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id TEXT, name TEXT, owner UUID
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/'); $$;

DO $$ BEGIN
  CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE anon;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- A plain, non-superuser role that does not own the tables: RLS is genuinely
-- enforced against it, which is the whole point of the exercise.
DO $$ BEGIN
  CREATE ROLE app_user LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated, anon TO app_user;
