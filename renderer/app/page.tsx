'use client'

import { useEffect, useState, useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { BookGrid } from '@/components/library'
import { getBooks, createBook, updateBook } from '@/lib/db'
import { supabase } from '@/lib/db/supabase'
import type { Book } from '@shared/types'

const STORAGE_BUCKET = 'books'

function titleFromPath(filePath: string): string {
  const filename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'Unknown'
  return filename.replace(/\.(pdf|epub)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Unknown'
}

function fileTypeFromPath(filePath: string): 'pdf' | 'epub' {
  return /\.epub$/i.test(filePath) ? 'epub' : 'pdf'
}

function toStorageSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function resolveUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) { setUserId(data.user.id); return }
      const { data: signInData, error } = await supabase.auth.signInAnonymously()
      if (signInData.user) setUserId(signInData.user.id)
      else if (error) setAuthError(error.message)
    }
    void resolveUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    void getBooks(userId).then(setBooks)
  }, [userId])

  const handleImport = useCallback(async () => {
    if (isDialogOpen || !userId) return
    setIsDialogOpen(true)
    setImportError(null)

    try {
      // ── Phase 1: instant ──────────────────────────────────────────────────
      // Open file dialog and create the book record immediately so the card
      // appears in the grid without waiting for metadata extraction or upload.
      const filePath = await window.electron.openFileDialog()
      setIsDialogOpen(false)
      if (!filePath) return

      const book = await createBook({
        user_id: userId,
        title: titleFromPath(filePath),
        file_type: fileTypeFromPath(filePath),
      })
      setBooks((prev) => [book, ...prev])
      setProcessingIds((prev) => new Set(prev).add(book.id))

      // ── Phase 2: background ───────────────────────────────────────────────
      // Extract metadata + upload without blocking the UI.
      void (async () => {
        try {
          const { metadata, fileBuffer } = await window.electron.importBook(filePath)
          const slug = toStorageSlug(metadata.title)
          const storagePath = `${userId}/${Date.now()}-${slug}.${metadata.file_type}`

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
              contentType: metadata.file_type === 'pdf' ? 'application/pdf' : 'application/epub+zip',
              upsert: false,
            })
          if (uploadError) throw new Error(`Storage: ${uploadError.message}`)

          const updated = await updateBook(book.id, {
            title: metadata.title,
            author: metadata.author,
            file_path: storagePath,
            total_pages: metadata.total_pages,
          })
          setBooks((prev) => prev.map((b) => (b.id === book.id ? updated : b)))
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Background import failed')
        } finally {
          setProcessingIds((prev) => { const s = new Set(prev); s.delete(book.id); return s })
        }
      })()
    } catch (err) {
      setIsDialogOpen(false)
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [isDialogOpen, userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return
    window.electron.onMenuEvent('import-book', () => void handleImport())
  }, [handleImport])

  const handleBookClick = useCallback((_book: Book) => {
    // Reader view wired up in step 4.
  }, [])

  return (
    <main className="flex flex-col min-h-screen">
      <header className="drag-region flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="no-drag text-sm font-semibold tracking-wide text-[var(--text-secondary)] select-none">
          Siddartha
        </span>
        <div className="no-drag">
          <Button variant="primary" onClick={() => void handleImport()} disabled={isDialogOpen || !userId}>
            {isDialogOpen ? 'Selecting…' : 'Import Book'}
          </Button>
        </div>
      </header>

      {authError && (
        <div className="no-drag mx-6 mt-3 px-4 py-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
          Auth error: {authError} — enable Anonymous sign-ins in Supabase dashboard → Authentication → Providers
        </div>
      )}
      {importError && (
        <div className="no-drag mx-6 mt-3 px-4 py-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          Import failed: {importError}
        </div>
      )}

      <section className="flex-1 overflow-y-auto">
        {books.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <EmptyState
              icon={BookOpen}
              title="Your library is empty"
              description="Import a PDF or EPUB to start reading. Your highlights and notes will be remembered forever."
              action={
                <Button variant="primary" onClick={() => void handleImport()} disabled={isDialogOpen || !userId}>
                  {isDialogOpen ? 'Selecting…' : 'Import your first book'}
                </Button>
              }
            />
          </div>
        ) : (
          <BookGrid books={books} onBookClick={handleBookClick} processingIds={processingIds} />
        )}
      </section>
    </main>
  )
}
