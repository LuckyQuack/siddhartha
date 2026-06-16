-- 001_initial — books, highlights, reading_sessions
-- Embeddings/themes/connections tables come in step 5 (memory engine).

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  author        TEXT,
  file_path     TEXT,                                              -- absolute path on disk
  file_type     TEXT CHECK (file_type IN ('pdf', 'epub')),
  cover_path    TEXT,                                              -- absolute path to extracted cover
  total_pages   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened   TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);

CREATE TABLE IF NOT EXISTS highlights (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  selected_text   TEXT NOT NULL,
  context_before  TEXT NOT NULL DEFAULT '',
  context_after   TEXT NOT NULL DEFAULT '',
  user_note       TEXT,
  chapter         TEXT,
  page_number     INTEGER,
  position_pct    REAL CHECK (position_pct IS NULL OR (position_pct BETWEEN 0 AND 1)),
  session_id      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_session ON highlights(session_id);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT,
  pages_read  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(book_id);
