import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

let dbInstance: Database.Database | null = null
let userIdCache: string | null = null

// Migrations embedded so they work whether the module is loaded from TypeScript
// source (ts-jest, __dirname = electron/db/) or compiled JS
// (electron:dev, __dirname = electron/dist/electron/db/ where no .sql files exist).
const EMBEDDED_MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: '001_initial.sql',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  author        TEXT,
  file_path     TEXT,
  file_type     TEXT CHECK (file_type IN ('pdf', 'epub')),
  cover_path    TEXT,
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
    `.trim(),
  },
]

export function loadMigrationFiles(): Array<{ name: string; sql: string }> {
  // Prefer disk files when they exist (ts-jest runs from source __dirname).
  // Fall back to embedded when running from a compiled dist directory.
  try {
    const dir = path.join(__dirname, 'migrations')
    if (fs.existsSync(dir)) {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
      if (files.length > 0) {
        return files.map((name) => ({
          name,
          sql: fs.readFileSync(path.join(dir, name), 'utf-8'),
        }))
      }
    }
  } catch {
    // fall through to embedded
  }
  return EMBEDDED_MIGRATIONS
}

export function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r: any) => r.name as string)
  )
  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)')
  for (const { name, sql } of loadMigrationFiles()) {
    if (applied.has(name)) continue
    db.transaction(() => {
      db.exec(sql)
      insert.run(name)
    })()
  }
}

export function openDb(filePath: string): Database.Database {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance
  // Lazy require so this module can be imported in jest without an Electron runtime.
  const { app } = require('electron') as typeof import('electron')
  dbInstance = openDb(path.join(app.getPath('userData'), 'siddhartha.db'))
  return dbInstance
}

export function ensureLocalUser(db: Database.Database = getDb()): string {
  const row = db.prepare('SELECT id FROM users LIMIT 1').get() as
    | { id: string }
    | undefined
  if (row) return row.id
  const id = randomUUID()
  db.prepare('INSERT INTO users (id) VALUES (?)').run(id)
  return id
}

export function getOrCreateLocalUserId(): string {
  if (userIdCache) return userIdCache
  userIdCache = ensureLocalUser()
  return userIdCache
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// ─── Test hooks ──────────────────────────────────────────────────────────────
// Prefixed with _ so the IPC layer never accidentally reaches for them.

export function _setDbForTesting(db: Database.Database): void {
  dbInstance = db
  userIdCache = null
}

export function _resetDbForTesting(): void {
  dbInstance = null
  userIdCache = null
}
