import { randomUUID } from 'crypto'
import { getDb } from '../client'

export interface HighlightRow {
  id: string
  user_id: string
  book_id: string
  selected_text: string
  context_before: string
  context_after: string
  user_note: string | null
  chapter: string | null
  page_number: number | null
  position_pct: number | null
  session_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateHighlightInput {
  user_id: string
  book_id: string
  selected_text: string
  context_before: string
  context_after: string
  user_note?: string | null
  chapter?: string | null
  page_number?: number | null
  position_pct?: number | null
  session_id?: string | null
}

export function createHighlight(input: CreateHighlightInput): HighlightRow {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO highlights (
         id, user_id, book_id, selected_text, context_before, context_after,
         user_note, chapter, page_number, position_pct, session_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.user_id,
      input.book_id,
      input.selected_text,
      input.context_before,
      input.context_after,
      input.user_note ?? null,
      input.chapter ?? null,
      input.page_number ?? null,
      input.position_pct ?? null,
      input.session_id ?? null
    )
  return getHighlightById(id)!
}

export function getHighlightById(id: string): HighlightRow | null {
  const row = getDb()
    .prepare('SELECT * FROM highlights WHERE id = ?')
    .get(id) as HighlightRow | undefined
  return row ?? null
}

export function listHighlightsByBook(bookId: string, userId: string): HighlightRow[] {
  return getDb()
    .prepare(
      'SELECT * FROM highlights WHERE book_id = ? AND user_id = ? ORDER BY created_at ASC'
    )
    .all(bookId, userId) as HighlightRow[]
}

export function listHighlightsBySession(sessionId: string): HighlightRow[] {
  return getDb()
    .prepare('SELECT * FROM highlights WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as HighlightRow[]
}
