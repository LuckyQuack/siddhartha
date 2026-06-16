import { randomUUID } from 'crypto'
import { getDb } from '../client'

export interface BookRow {
  id: string
  user_id: string
  title: string
  author: string | null
  file_path: string | null
  file_type: 'pdf' | 'epub' | null
  cover_path: string | null
  total_pages: number | null
  created_at: string
  updated_at: string
  last_opened: string | null
}

export interface CreateBookInput {
  user_id: string
  title: string
  author?: string | null
  file_type?: 'pdf' | 'epub' | null
}

export interface UpdateBookInput {
  title?: string
  author?: string | null
  file_path?: string | null
  total_pages?: number | null
  cover_path?: string | null
}

export function listBooks(userId: string): BookRow[] {
  return getDb()
    .prepare(
      'SELECT * FROM books WHERE user_id = ? ORDER BY COALESCE(last_opened, created_at) DESC'
    )
    .all(userId) as BookRow[]
}

export function getBookById(id: string, userId: string): BookRow | null {
  const row = getDb()
    .prepare('SELECT * FROM books WHERE id = ? AND user_id = ?')
    .get(id, userId) as BookRow | undefined
  return row ?? null
}

export function createBook(input: CreateBookInput): BookRow {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO books (id, user_id, title, author, file_type)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, input.user_id, input.title, input.author ?? null, input.file_type ?? null)
  return getBookById(id, input.user_id)!
}

export function updateBook(id: string, userId: string, patch: UpdateBookInput): BookRow {
  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    fields.push(`${key} = ?`)
    values.push(value)
  }
  if (fields.length === 0) return getBookById(id, userId)!
  fields.push(`updated_at = datetime('now')`)
  values.push(id, userId)
  getDb()
    .prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values)
  return getBookById(id, userId)!
}

export function touchLastOpened(id: string, userId: string): void {
  getDb()
    .prepare(`UPDATE books SET last_opened = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(id, userId)
}

export function deleteBook(id: string, userId: string): void {
  getDb().prepare('DELETE FROM books WHERE id = ? AND user_id = ?').run(id, userId)
}
