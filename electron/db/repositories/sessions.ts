import { randomUUID } from 'crypto'
import { getDb } from '../client'

export interface SessionRow {
  id: string
  user_id: string
  book_id: string
  started_at: string
  ended_at: string | null
  pages_read: number | null
}

export interface StartSessionInput {
  user_id: string
  book_id: string
}

export function startSession(input: StartSessionInput): SessionRow {
  const id = randomUUID()
  getDb()
    .prepare(`INSERT INTO reading_sessions (id, user_id, book_id) VALUES (?, ?, ?)`)
    .run(id, input.user_id, input.book_id)
  return getSessionById(id)!
}

export function endSession(id: string, pagesRead?: number | null): SessionRow | null {
  getDb()
    .prepare(
      `UPDATE reading_sessions
       SET ended_at = datetime('now'),
           pages_read = COALESCE(?, pages_read)
       WHERE id = ? AND ended_at IS NULL`
    )
    .run(pagesRead ?? null, id)
  return getSessionById(id)
}

export function getSessionById(id: string): SessionRow | null {
  const row = getDb()
    .prepare('SELECT * FROM reading_sessions WHERE id = ?')
    .get(id) as SessionRow | undefined
  return row ?? null
}
