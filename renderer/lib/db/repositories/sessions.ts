import { ReadingSession } from '@prisma/client'
import { prisma } from '../client'

export type CreateSessionInput = {
  userId: string
  bookId: string
  startedAt?: Date
}

export const sessionRepository = {
  create(data: CreateSessionInput): Promise<ReadingSession> {
    return prisma.readingSession.create({
      data: {
        ...data,
        startedAt: data.startedAt ?? new Date(),
      },
    })
  },

  end(id: string, pagesRead: number): Promise<ReadingSession> {
    return prisma.readingSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        pagesRead,
      },
    })
  },

  findByBook(bookId: string): Promise<ReadingSession[]> {
    return prisma.readingSession.findMany({
      where: { bookId },
      orderBy: { startedAt: 'desc' },
    })
  },
}
