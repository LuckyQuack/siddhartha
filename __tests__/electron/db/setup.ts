/** Shared test setup for electron/db repositories. */
import Database from 'better-sqlite3'
import { applyMigrations, _setDbForTesting, _resetDbForTesting } from '../../../electron/db/client'

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'
export const TEST_BOOK_ID = '22222222-2222-2222-2222-222222222222'

export function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  db.prepare('INSERT INTO users (id) VALUES (?)').run(TEST_USER_ID)
  _setDbForTesting(db)
  return db
}

export function teardown(db: Database.Database): void {
  _resetDbForTesting()
  db.close()
}
