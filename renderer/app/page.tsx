'use client'

import { useEffect, useState, useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { BookGrid } from '@/components/library'
import { getBooks, createBook } from '@/lib/db'
import { supabase } from '@/lib/db/supabase'
import type { Book } from '@shared/types'

const STORAGE_BUCKET = 'books'

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Resolve the current user on mount and keep in sync with auth changes.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load library whenever the user resolves.
  useEffect(() => {
    if (!userId) return
    void getBooks(userId).then(setBooks)
  }, [userId])

  const handleImport = useCallback(async () => {
    if (isImporting || !userId) return
    setIsImporting(true)

    try {
      const filePath = await window.electron.openFileDialog()
      if (!filePath) return

      // Extract metadata + file bytes in one IPC round-trip.
      const { metadata, fileBuffer } = await window.electron.importBook(filePath)

      // Upload raw bytes to Supabase Storage.
      const ext = metadata.file_type
      const storagePath = `${userId}/${Date.now()}-${metadata.title.replace(/\s+/g, '-')}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: ext === 'pdf' ? 'application/pdf' : 'application/epub+zip',
          upsert: false,
        })
      if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`)

      // Persist the book record and prepend it to the grid.
      const book = await createBook({
        user_id: userId,
        title: metadata.title,
        author: metadata.author,
        file_path: storagePath,
        file_type: metadata.file_type,
        total_pages: metadata.total_pages,
      })
      setBooks((prev) => [book, ...prev])
    } catch (err) {
      // Failed imports must never be silent — a toast will replace this in a future iteration.
      console.error('[import] failed:', err)
    } finally {
      setIsImporting(false)
    }
  }, [isImporting, userId])

  // Listen for "File > Import Book" from the app menu.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return
    window.electron.onMenuEvent('import-book', () => void handleImport())
  }, [handleImport])

  const handleBookClick = useCallback((_book: Book) => {
    // Reader view wired up in step 4.
  }, [])

  return (
    <main className="flex flex-col min-h-screen">
      {/* Title bar — drag region so users can move the frameless window */}
      <header className="drag-region flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="no-drag text-sm font-semibold tracking-wide text-[var(--text-secondary)] select-none">
          Siddartha
        </span>

        <div className="no-drag">
          <Button
            variant="primary"
            onClick={() => void handleImport()}
            disabled={isImporting || !userId}
          >
            {isImporting ? 'Importing…' : 'Import Book'}
          </Button>
        </div>
      </header>

      {/* Library content */}
      <section className="flex-1 overflow-y-auto">
        {books.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <EmptyState
              icon={BookOpen}
              title="Your library is empty"
              description="Import a PDF or EPUB to start reading. Your highlights and notes will be remembered forever."
              action={
                <Button
                  variant="primary"
                  onClick={() => void handleImport()}
                  disabled={isImporting || !userId}
                >
                  {isImporting ? 'Importing…' : 'Import your first book'}
                </Button>
              }
            />
          </div>
        ) : (
          <BookGrid books={books} onBookClick={handleBookClick} />
        )}
      </section>
    </main>
  )
}
