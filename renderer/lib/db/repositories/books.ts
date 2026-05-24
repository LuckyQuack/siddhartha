import { Book } from '@prisma/client'
import { prisma } from '../client'

export type CreateBookInput = {
  userId: string
  title: string
  author?: string
  filePath?: string
  fileType?: 'pdf' | 'epub'
  coverUrl?: string
  totalPages?: number
}

export const bookRepository = {
  findAll(userId: string): Promise<Book[]> {
    return prisma.book.findMany({
      where: { userId },
      orderBy: { lastOpened: 'desc' },
    })
  },

  findById(id: string, userId: string): Promise<Book | null> {
    return prisma.book.findFirst({
      where: { id, userId },
    })
  },

  create(data: CreateBookInput): Promise<Book> {
    return prisma.book.create({ data })
  },

  updateLastOpened(id: string, userId: string): Promise<Book> {
    return prisma.book.update({
      where: { id },
      data: { lastOpened: new Date() },
    })
  },

  async delete(id: string, userId: string): Promise<void> {
    await prisma.book.deleteMany({ where: { id, userId } })
  },
}
