-- Create the books storage bucket and its RLS policies.
-- Files are stored at {user_id}/{timestamp}-{title}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'books',
  'books',
  false,
  52428800, -- 50 MiB
  ARRAY['application/pdf', 'application/epub+zip']
)
ON CONFLICT (id) DO NOTHING;

-- Users can upload files only into their own folder.
CREATE POLICY "books_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files.
CREATE POLICY "books_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files.
CREATE POLICY "books_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'books'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
