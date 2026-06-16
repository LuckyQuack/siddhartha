// Renderer-side DB layer. All calls proxy to the Electron main process via
// window.api (contextBridge) → IPC → SQLite repositories.
// This file must never import 'electron' or Node.js APIs directly.

import type {
  Book,
  Highlight,
  ReadingSession,
  CreateBookInput,
  UpdateBookInput,
  CreateHighlightInput,
} from '@shared/types'

function api() {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('window.api is unavailable — are you running outside Electron?')
  }
  return window.api
}

// ── User ────────────────────────────────────────────────────────────────────

export function getOrCreateUserId(): Promise<string> {
  return api().user.getOrCreateId()
}

// ── Books ───────────────────────────────────────────────────────────────────

export function listBooks(userId: string): Promise<Book[]> {
  return api().books.list(userId)
}

export function getBook(id: string, userId: string): Promise<Book | null> {
  return api().books.get(id, userId)
}

export function createBook(input: CreateBookInput): Promise<Book> {
  return api().books.create(input)
}

export function updateBook(id: string, userId: string, patch: UpdateBookInput): Promise<Book> {
  return api().books.update(id, userId, patch)
}

export function deleteBook(id: string, userId: string): Promise<void> {
  return api().books.delete(id, userId)
}

export function touchLastOpened(id: string, userId: string): Promise<void> {
  return api().books.touch(id, userId)
}

export function saveCover(bookId: string, data: Uint8Array, mimeType: string): Promise<string> {
  return api().books.saveCover(bookId, data, mimeType)
}

// ── Highlights ───────────────────────────────────────────────────────────────

export function createHighlight(input: CreateHighlightInput): Promise<Highlight> {
  return api().highlights.create(input)
}

export function listHighlightsByBook(bookId: string, userId: string): Promise<Highlight[]> {
  return api().highlights.listByBook(bookId, userId)
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function startSession(input: { user_id: string; book_id: string }): Promise<ReadingSession> {
  return api().sessions.start(input)
}

export function endSession(id: string, pagesRead?: number | null): Promise<ReadingSession | null> {
  return api().sessions.end(id, pagesRead)
}

export type { Book, Highlight, ReadingSession, CreateBookInput, UpdateBookInput, CreateHighlightInput }
