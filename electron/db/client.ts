import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

let dbInstance: Database.Database | null = null
let userIdCache: string | null = null

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export function loadMigrationFiles(): Array<{ name: string; sql: string }> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8'),
    }))
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
