// Barrel export for the entire db layer.
// Components import from here — never directly from sub-modules.

export { prisma } from './client'

export { bookRepository } from './repositories/books'
export type { CreateBookInput } from './repositories/books'

export { highlightRepository } from './repositories/highlights'
export type { CreateHighlightInput, HighlightWithThemes } from './repositories/highlights'

export { sessionRepository } from './repositories/sessions'
export type { CreateSessionInput } from './repositories/sessions'
