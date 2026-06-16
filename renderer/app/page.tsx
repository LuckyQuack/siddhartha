'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { BookGrid } from '@/components/library'
import { listBooks, createBook, updateBook, saveCover } from '@/lib/db'
import type { Book } from '@shared/types'
import type { ImportProgress } from '@/components/library/BookCard'

function titleFromPath(filePath: string): string {
  const filename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'Unknown'
  return filename.replace(/\.(pdf|epub)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Unknown'
}

function fileTypeFromPath(filePath: string): 'pdf' | 'epub' {
  return /\.epub$/i.test(filePath) ? 'epub' : 'pdf'
}

export default function LibraryPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [importProgress, setImportProgress] = useState<Map<string, ImportProgress>>(new Map())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    void window.api.user.getOrCreateId().then(setUserId)
  }, [])

  useEffect(() => {
    if (!userId) return
    void listBooks(userId).then(setBooks)
  }, [userId])

  function setProgress(id: string, p: ImportProgress) {
    setImportProgress((prev) => new Map(prev).set(id, p))
  }
  function clearProgress(id: string) {
    setImportProgress((prev) => { const m = new Map(prev); m.delete(id); return m })
  }

  const handleImport = useCallback(async () => {
    if (isDialogOpen || !userId) return
    if (typeof window === 'undefined' || !window.electron || !window.api) {
      setImportError('Import requires the desktop app — run "npm run electron:dev".')
      return
    }
    setIsDialogOpen(true)
    setImportError(null)
    try {
      const filePath = await window.electron.openFileDialog()
      setIsDialogOpen(false)
      if (!filePath) return

      const book = await createBook({ user_id: userId, title: titleFromPath(filePath), file_type: fileTypeFromPath(filePath) })
      setBooks((prev) => [book, ...prev])
      setProgress(book.id, { phase: 'extracting', pct: 0 })

      void (async () => {
        try {
          const { metadata, coverBuffer, coverMimeType } = await window.electron.importBook(filePath)
          setProgress(book.id, { phase: 'saving', pct: 0 })
          let coverPath: string | null = null
          if (coverBuffer && coverMimeType) {
            coverPath = await window.api.books.saveCover(book.id, coverBuffer, coverMimeType)
          }
          const updated = await updateBook(book.id, userId, {
            title: metadata.title,
            author: metadata.author,
            file_path: filePath,
            total_pages: metadata.total_pages,
            cover_path: coverPath,
          })
          setBooks((prev) => prev.map((b) => (b.id === book.id ? updated : b)))
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Import failed')
        } finally {
          clearProgress(book.id)
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

  const handleBookClick = useCallback((book: Book) => {
    router.push(`/read/${book.id}`)
  }, [router])

  return (
    <main className="flex flex-col min-h-screen bg-[var(--surface-base)]">
      {/* Title bar */}
      <header className="drag-region flex items-center justify-between px-8 py-4 border-b border-[var(--border-subtle)]">
        <span className="no-drag font-display text-base font-semibold text-[var(--text-primary)] select-none tracking-tight">
          Siddhartha
        </span>
        <div className="no-drag">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleImport()}
            disabled={isDialogOpen || !userId}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {isDialogOpen ? 'Selecting…' : 'Import'}
          </Button>
        </div>
      </header>

      {importError && (
        <div className="no-drag mx-8 mt-4 px-4 py-3 rounded bg-red-50 border border-red-200 text-xs font-serif text-red-700">
          {importError}
        </div>
      )}

      <section className="flex-1 overflow-y-auto">
        {books.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <EmptyState
              icon={BookOpen}
              title="Your library is empty"
              description="Import a PDF or EPUB to begin. Every highlight you save will be remembered and connected."
              action={
                <Button variant="primary" onClick={() => void handleImport()} disabled={isDialogOpen || !userId}>
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Import your first book
                </Button>
              }
            />
          </div>
        ) : (
          <BookGrid books={books} onBookClick={handleBookClick} importProgress={importProgress} />
        )}
      </section>
    </main>
  )
}
