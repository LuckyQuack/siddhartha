// Barrel export for the entire db layer.
// Components import from here — never directly from sub-modules.

// Prisma client + repositories (main-process / server-side use)
export { prisma } from './client'

export { bookRepository } from './repositories/books'
export type { CreateBookInput as PrismaCreateBookInput } from './repositories/books'

export { highlightRepository } from './repositories/highlights'
export type { CreateHighlightInput, HighlightWithThemes } from './repositories/highlights'

export { sessionRepository } from './repositories/sessions'
export type { CreateSessionInput } from './repositories/sessions'

// Supabase JS client + functions (renderer / browser-side use)
export { supabase } from './supabase'
export { getBooks, createBook, updateLastOpened, deleteBook } from './supabase-books'
export type { CreateBookInput } from './supabase-books'
