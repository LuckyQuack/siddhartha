-- Relax the books bucket: remove mime-type restriction (any file the app
-- uploads is already filtered by the Electron file dialog) and raise the
-- size cap to 200 MiB to accommodate large academic PDFs.
UPDATE storage.buckets
SET
  allowed_mime_types = NULL,
  file_size_limit    = 209715200 -- 200 MiB
WHERE id = 'books';
