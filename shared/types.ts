// Shared domain types used by both the Electron main process and the
// Next.js renderer. Keep this file free of any runtime-specific imports
// so it can be safely imported in either context.

// ─── Literals ─────────────────────────────────────────────────────────────────

export type FileType = 'pdf' | 'epub'

// Three embeddings are stored per highlight. 'note' only exists when
// the user has added an annotation to the highlight.
export type EmbeddingType = 'text' | 'text_context' | 'note'

// ─── Database entities ─────────────────────────────────────────────────────────
// These interfaces mirror the Postgres schema defined in CLAUDE.md exactly.
// All uuid fields are typed as string (UUID v4 at runtime).
// All timestamptz fields are typed as string (ISO 8601).

export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  /** Supabase Storage object path, e.g. "books/user123/moby-dick.pdf" */
  file_path: string | null
  file_type: FileType | null
  cover_url: string | null
  total_pages: number | null
  created_at: string
  last_opened: string | null
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  /** Verbatim text the user selected. Never mutate after capture. */
  selected_text: string
  /** 150 words of text immediately before the selection. Required — never null. */
  context_before: string
  /** 150 words of text immediately after the selection. Required — never null. */
  context_after: string
  /** Optional annotation typed by the user. */
  user_note: string | null
  chapter: string | null
  page_number: number | null
  /** Fractional scroll position 0–1 within the document. */
  position_pct: number | null
  session_id: string | null
  created_at: string
}

export interface HighlightEmbedding {
  id: string
  highlight_id: string
  embedding_type: EmbeddingType
  /** 1024-dimensional float vector from Voyage AI voyage-3. */
  embedding: number[]
  /** Embedding model identifier, e.g. "voyage-3". */
  model: string
  created_at: string
}

export interface HighlightTheme {
  id: string
  highlight_id: string
  /** Human-readable theme label extracted by Claude, e.g. "expert epistemics". */
  theme: string
  /** Claude's confidence in this theme assignment, 0–1. */
  confidence: number
  created_at: string
}

export interface HighlightConnection {
  id: string
  highlight_a: string
  highlight_b: string
  /** Cosine similarity between the two highlight embeddings, 0–1. */
  similarity: number
  /** Themes shared by both highlights that explain the connection. */
  shared_themes: string[]
  created_at: string
}

export interface ReadingSession {
  id: string
  user_id: string
  book_id: string
  started_at: string
  ended_at: string | null
  pages_read: number | null
}

// ─── Import pipeline types ─────────────────────────────────────────────────────

export interface BookMetadata {
  title: string
  author: string | null
  total_pages: number | null
  file_type: FileType
  local_path: string
  file_size: number
}

export interface ImportBookResult {
  metadata: BookMetadata
  /** Raw file bytes (Uint8Array) for upload to Supabase Storage. */
  fileBuffer: Uint8Array
  /** Cover image bytes extracted from the EPUB (null for PDF or if not found). */
  coverBuffer: Uint8Array | null
  /** MIME type of the cover image, e.g. 'image/jpeg'. */
  coverMimeType: string | null
}

// ─── IPC message types ─────────────────────────────────────────────────────────
// Used to type the window.electron bridge defined in electron/preload.ts.

export interface ElectronAPI {
  /** Open the OS native file picker filtered to PDF and EPUB. Returns the
   *  chosen file path or null if the user cancelled. */
  openFileDialog: () => Promise<string | null>
  /** Read a local file by absolute path and return its binary contents. */
  readFile: (path: string) => Promise<Buffer>
  /** Extract metadata and read file bytes in a single IPC round-trip. */
  importBook: (filePath: string) => Promise<ImportBookResult>
  /** Subscribe to menu-driven events forwarded from the main process. */
  onMenuEvent: (event: string, callback: () => void) => void
}

// Augment the global Window type so renderer code can access the bridge
// without unsafe casts.
declare global {
  interface Window {
    electron: ElectronAPI
  }
}
