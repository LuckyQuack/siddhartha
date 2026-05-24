import { prisma } from './client'
import type { Book } from '@shared/types'

// All database access for the books table goes through this repository.
// Components never call prisma directly — they call these typed functions.

export async function listBooks(userId: string): Promise<Book[]> {
  const rows = await prisma.book.findMany({
    where: { user_id: userId },
    orderBy: { last_opened: 'desc' },
  })
  return rows as unknown as Book[]
}

export async function getBook(id: string, userId: string): Promise<Book | null> {
  const row = await prisma.book.findFirst({
    where: { id, user_id: userId },
  })
  return row as unknown as Book | null
}

export async function createBook(
  data: Omit<Book, 'id' | 'created_at' | 'last_opened'>
): Promise<Book> {
  const row = await prisma.book.create({ data: data as Parameters<typeof prisma.book.create>[0]['data'] })
  return row as unknown as Book
}

export async function touchLastOpened(id: string, userId: string): Promise<void> {
  await prisma.book.updateMany({
    where: { id, user_id: userId },
    data: { last_opened: new Date().toISOString() },
  })
}
