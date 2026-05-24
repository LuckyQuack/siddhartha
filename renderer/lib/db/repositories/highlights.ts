import { Highlight, HighlightTheme } from '@prisma/client'
import { prisma } from '../client'

export type CreateHighlightInput = {
  userId: string
  bookId: string
  selectedText: string
  // Context windows are mandatory for the memory system — always provide them
  contextBefore: string
  contextAfter: string
  userNote?: string
  chapter?: string
  pageNumber?: number
  positionPct?: number
  sessionId?: string
}

export type HighlightWithThemes = Highlight & {
  themes: HighlightTheme[]
}

export const highlightRepository = {
  findByBook(bookId: string, userId: string): Promise<Highlight[]> {
    return prisma.highlight.findMany({
      where: { bookId, userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findById(id: string): Promise<Highlight | null> {
    return prisma.highlight.findUnique({
      where: { id },
    })
  },

  create(data: CreateHighlightInput): Promise<Highlight> {
    return prisma.highlight.create({ data })
  },

  findRecent(userId: string, limit: number): Promise<Highlight[]> {
    return prisma.highlight.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  findByTheme(userId: string, theme: string): Promise<HighlightWithThemes[]> {
    // Join through highlight_themes to find highlights tagged with the given theme
    return prisma.highlight.findMany({
      where: {
        userId,
        themes: {
          some: { theme },
        },
      },
      include: { themes: true },
      orderBy: { createdAt: 'desc' },
    })
  },
}
