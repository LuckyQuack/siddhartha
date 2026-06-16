// Renderer-side DB layer.
// Step 1: only Supabase JS remains here; Prisma was deleted.
// Step 2 will replace these Supabase exports with `window.api.*` IPC calls.

export { supabase } from './supabase'
export { getBook, getBooks, createBook, updateBook, updateLastOpened, deleteBook } from './supabase-books'
export type { CreateBookInput, UpdateBookInput } from './supabase-books'
