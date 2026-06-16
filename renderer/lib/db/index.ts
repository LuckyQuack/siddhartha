// Renderer-side DB layer — all exports backed by IPC → SQLite.
export {
  getOrCreateUserId,
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  touchLastOpened,
  saveCover,
  createHighlight,
  listHighlightsByBook,
  startSession,
  endSession,
} from './api'

export type { CreateBookInput, UpdateBookInput, CreateHighlightInput } from './api'
