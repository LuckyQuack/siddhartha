// Types shared between the Electron main process and the Next.js renderer.
// Keep this file lean — only put types here that cross the IPC boundary.

export type FileType = 'pdf' | 'epub'

export type EmbeddingType = 'text' | 'text_context' | 'note'

// Mirrors the books table
export interface Book {
  id: string
  userId: string
  title: string
  author: string | null
  filePath: string | null
  fileType: FileType | null
  coverUrl: string | null
  totalPages: number | null
  createdAt: Date
  lastOpened: Date | null
  updatedAt: Date
}

// Mirrors the highlights table
export interface Highlight {
  id: string
  userId: string
  bookId: string
  selectedText: string
  contextBefore: string | null
  contextAfter: string | null
  userNote: string | null
  chapter: string | null
  pageNumber: number | null
  positionPct: number | null
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}

// Mirrors the reading_sessions table
export interface ReadingSession {
  id: string
  userId: string
  bookId: string
  startedAt: Date | null
  endedAt: Date | null
  pagesRead: number | null
  updatedAt: Date
}

// Mirrors the highlight_themes table
export interface HighlightTheme {
  id: string
  highlightId: string
  theme: string
  confidence: number | null
  createdAt: Date
}

// Mirrors the highlight_connections table
export interface HighlightConnection {
  id: string
  highlightAId: string
  highlightBId: string
  similarity: number | null
  sharedThemes: string[]
  createdAt: Date
}

// IPC channel names — keeps main and renderer in sync
export const IPC_CHANNELS = {
  OPEN_FILE: 'file:open',
  SAVE_FILE: 'file:save',
  GET_USER_DATA_PATH: 'app:getUserDataPath',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
