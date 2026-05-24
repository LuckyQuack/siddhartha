import { prisma } from './client'
import type { Highlight } from '@shared/types'

// Repository for the highlights table.
// context_before and context_after are NEVER optional — the schema enforces
// this and so does the TypeScript type. Any call site that omits them is a bug.

export async function createHighlight(
  data: Omit<Highlight, 'id' | 'created_at'>
): Promise<Highlight> {
  const row = await prisma.highlight.create({
    data: data as Parameters<typeof prisma.highlight.create>[0]['data'],
  })
  return row as unknown as Highlight
}

export async function listHighlightsForBook(
  bookId: string,
  userId: string
): Promise<Highlight[]> {
  const rows = await prisma.highlight.findMany({
    where: { book_id: bookId, user_id: userId },
    orderBy: { created_at: 'asc' },
  })
  return rows as unknown as Highlight[]
}

export async function getHighlight(id: string, userId: string): Promise<Highlight | null> {
  const row = await prisma.highlight.findFirst({
    where: { id, user_id: userId },
  })
  return row as unknown as Highlight | null
}

export async function updateHighlightNote(
  id: string,
  userId: string,
  note: string
): Promise<void> {
  await prisma.highlight.updateMany({
    where: { id, user_id: userId },
    data: { user_note: note },
  })
}
