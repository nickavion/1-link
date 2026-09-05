-- Cover-image bucket for the event form's upload field.
-- Public read, authenticated write, and every object lives under a folder named
-- for its uploader — so nobody can overwrite, or list into, someone else's files.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "event images are publicly readable" ON storage.objects;
CREATE POLICY "event images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

-- Path convention: event-images/<auth.uid()>/<uuid>.<ext>
DROP POLICY IF EXISTS "authenticated users upload to their own folder" ON storage.objects;
CREATE POLICY "authenticated users upload to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users update their own event images" ON storage.objects;
CREATE POLICY "users update their own event images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users delete their own event images" ON storage.objects;
CREATE POLICY "users delete their own event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
