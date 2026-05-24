-- ============================================================
-- Migration: 20260523000001_initial_schema
-- Description: Initial schema for Siddartha reading app
-- Includes: all core tables, RLS policies, indexes, pgvector
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE books (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users,
  title         text NOT NULL,
  author        text,
  file_path     text,
  file_type     text CHECK (file_type IN ('pdf', 'epub')),
  cover_url     text,
  total_pages   int,
  created_at    timestamptz DEFAULT now(),
  last_opened   timestamptz,
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE highlights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users,
  book_id         uuid REFERENCES books(id) ON DELETE CASCADE,
  selected_text   text NOT NULL,
  context_before  text,
  context_after   text,
  user_note       text,
  chapter         text,
  page_number     int,
  position_pct    float CHECK (position_pct BETWEEN 0 AND 1),
  session_id      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE highlight_embeddings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id    uuid REFERENCES highlights(id) ON DELETE CASCADE,
  embedding_type  text CHECK (embedding_type IN ('text', 'text_context', 'note')),
  embedding       vector(1024),
  model           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE highlight_themes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id  uuid REFERENCES highlights(id) ON DELETE CASCADE,
  theme         text NOT NULL,
  confidence    float CHECK (confidence BETWEEN 0 AND 1),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE highlight_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_a     uuid REFERENCES highlights(id) ON DELETE CASCADE,
  highlight_b     uuid REFERENCES highlights(id) ON DELETE CASCADE,
  similarity      float CHECK (similarity BETWEEN 0 AND 1),
  shared_themes   text[],
  created_at      timestamptz DEFAULT now(),
  UNIQUE(highlight_a, highlight_b)
);

CREATE TABLE reading_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users,
  book_id     uuid REFERENCES books(id) ON DELETE CASCADE,
  started_at  timestamptz,
  ended_at    timestamptz,
  pages_read  int,
  updated_at  timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reading_sessions_updated_at
  BEFORE UPDATE ON reading_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX ON books (user_id);
CREATE INDEX ON highlights (book_id);
CREATE INDEX ON highlights (user_id);
CREATE INDEX ON highlight_embeddings (highlight_id);
CREATE INDEX ON highlight_connections (highlight_a);
CREATE INDEX ON highlight_connections (highlight_b);

-- hnsw index for fast cosine similarity search across all embeddings
CREATE INDEX ON highlight_embeddings USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

-- books: users can only see and modify their own books
CREATE POLICY "books_owner" ON books
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- highlights: users can only see and modify their own highlights
CREATE POLICY "highlights_owner" ON highlights
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- highlight_embeddings: accessible when the parent highlight belongs to the user
CREATE POLICY "highlight_embeddings_owner" ON highlight_embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM highlights h
      WHERE h.id = highlight_id
        AND h.user_id = auth.uid()
    )
  );

-- highlight_themes: accessible when the parent highlight belongs to the user
CREATE POLICY "highlight_themes_owner" ON highlight_themes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM highlights h
      WHERE h.id = highlight_id
        AND h.user_id = auth.uid()
    )
  );

-- highlight_connections: accessible when either highlight belongs to the user
CREATE POLICY "highlight_connections_owner" ON highlight_connections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM highlights h
      WHERE (h.id = highlight_a OR h.id = highlight_b)
        AND h.user_id = auth.uid()
    )
  );

-- reading_sessions: users can only see and modify their own sessions
CREATE POLICY "reading_sessions_owner" ON reading_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DOWN (rollback — run manually if needed)
-- ============================================================
-- DROP TABLE IF EXISTS reading_sessions CASCADE;
-- DROP TABLE IF EXISTS highlight_connections CASCADE;
-- DROP TABLE IF EXISTS highlight_themes CASCADE;
-- DROP TABLE IF EXISTS highlight_embeddings CASCADE;
-- DROP TABLE IF EXISTS highlights CASCADE;
-- DROP TABLE IF EXISTS books CASCADE;
-- DROP FUNCTION IF EXISTS set_updated_at CASCADE;
-- DROP EXTENSION IF EXISTS vector;
