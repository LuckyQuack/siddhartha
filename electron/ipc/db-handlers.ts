import { app, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { getDb, getOrCreateLocalUserId } from '../db/client'
import {
  listBooks,
  getBookById,
  createBook,
  updateBook,
  touchLastOpened,
  deleteBook,
  type BookRow,
  type CreateBookInput,
  type UpdateBookInput,
} from '../db/repositories/books'
import {
  createHighlight,
  listHighlightsByBook,
  type HighlightRow,
  type CreateHighlightInput,
} from '../db/repositories/highlights'
import { startSession, endSession, type SessionRow } from '../db/repositories/sessions'
import type { Book, Highlight, ReadingSession } from '../../shared/types'

// ─── Mappers ─────────────────────────────────────────────────────────────────

function bookRowToBook(row: BookRow): Book {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    author: row.author,
    file_path: row.file_path,
    file_type: row.file_type,
    cover_url: row.cover_path ? pathToFileURL(row.cover_path).href : null,
    total_pages: row.total_pages,
    created_at: row.created_at,
    last_opened: row.last_opened,
  }
}

function highlightRowToHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    selected_text: row.selected_text,
    context_before: row.context_before,
    context_after: row.context_after,
    user_note: row.user_note,
    chapter: row.chapter,
    page_number: row.page_number,
    position_pct: row.position_pct,
    session_id: row.session_id,
    created_at: row.created_at,
  }
}

function sessionRowToSession(row: SessionRow): ReadingSession {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    pages_read: row.pages_read,
  }
}

// ─── Cover helpers ────────────────────────────────────────────────────────────

function coversDir(): string {
  const dir = path.join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function extFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerDbHandlers(): void {
  // Ensure the DB is open and migrations are applied before any handler runs.
  getDb()

  // ── User ──────────────────────────────────────────────────────────────────
  ipcMain.handle('db:user:get-or-create-id', (): string => {
    return getOrCreateLocalUserId()
  })

  // ── Books ─────────────────────────────────────────────────────────────────
  ipcMain.handle('db:books:list', (_e, userId: unknown): Book[] => {
    if (typeof userId !== 'string') throw new Error('db:books:list: userId must be a string')
    return listBooks(userId).map(bookRowToBook)
  })

  ipcMain.handle('db:books:create', (_e, input: unknown): Book => {
    if (!input || typeof input !== 'object') throw new Error('db:books:create: invalid input')
    return bookRowToBook(createBook(input as CreateBookInput))
  })

  ipcMain.handle('db:books:get', (_e, id: unknown, userId: unknown): Book | null => {
    if (typeof id !== 'string') throw new Error('db:books:get: id must be a string')
    if (typeof userId !== 'string') throw new Error('db:books:get: userId must be a string')
    const row = getBookById(id, userId)
    return row ? bookRowToBook(row) : null
  })

  ipcMain.handle('db:books:update', (_e, id: unknown, userId: unknown, patch: unknown): Book => {
    if (typeof id !== 'string') throw new Error('db:books:update: id must be a string')
    if (typeof userId !== 'string') throw new Error('db:books:update: userId must be a string')
    if (!patch || typeof patch !== 'object') throw new Error('db:books:update: invalid patch')
    return bookRowToBook(updateBook(id, userId, patch as UpdateBookInput))
  })

  ipcMain.handle('db:books:delete', (_e, id: unknown, userId: unknown): void => {
    if (typeof id !== 'string') throw new Error('db:books:delete: id must be a string')
    if (typeof userId !== 'string') throw new Error('db:books:delete: userId must be a string')
    deleteBook(id, userId)
  })

  ipcMain.handle('db:books:touch', (_e, id: unknown, userId: unknown): void => {
    if (typeof id !== 'string') throw new Error('db:books:touch: id must be a string')
    if (typeof userId !== 'string') throw new Error('db:books:touch: userId must be a string')
    touchLastOpened(id, userId)
  })

  ipcMain.handle('db:books:save-cover', (_e, bookId: unknown, data: unknown, mimeType: unknown): string => {
    if (typeof bookId !== 'string') throw new Error('db:books:save-cover: bookId must be a string')
    if (typeof mimeType !== 'string') throw new Error('db:books:save-cover: mimeType must be a string')
    if (!(data instanceof Uint8Array) && !Buffer.isBuffer(data)) {
      throw new Error('db:books:save-cover: data must be a Uint8Array')
    }
    const ext = extFromMimeType(mimeType)
    const coverPath = path.join(coversDir(), `${bookId}.${ext}`)
    fs.writeFileSync(coverPath, data as Buffer)
    return coverPath
  })

  // ── Highlights ────────────────────────────────────────────────────────────
  ipcMain.handle('db:highlights:create', (_e, input: unknown): Highlight => {
    if (!input || typeof input !== 'object') throw new Error('db:highlights:create: invalid input')
    return highlightRowToHighlight(createHighlight(input as CreateHighlightInput))
  })

  ipcMain.handle('db:highlights:list-by-book', (_e, bookId: unknown, userId: unknown): Highlight[] => {
    if (typeof bookId !== 'string') throw new Error('db:highlights:list-by-book: bookId must be a string')
    if (typeof userId !== 'string') throw new Error('db:highlights:list-by-book: userId must be a string')
    return listHighlightsByBook(bookId, userId).map(highlightRowToHighlight)
  })

  // ── Sessions ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:sessions:start', (_e, input: unknown): ReadingSession => {
    if (!input || typeof input !== 'object') throw new Error('db:sessions:start: invalid input')
    const { user_id, book_id } = input as { user_id: string; book_id: string }
    return sessionRowToSession(startSession({ user_id, book_id }))
  })

  ipcMain.handle('db:sessions:end', (_e, id: unknown, pagesRead: unknown): ReadingSession | null => {
    if (typeof id !== 'string') throw new Error('db:sessions:end: id must be a string')
    const pages = typeof pagesRead === 'number' ? pagesRead : null
    const row = endSession(id, pages)
    return row ? sessionRowToSession(row) : null
  })
}
