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
  const [importError, setImportError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // Resolve the current user on mount. If no session exists, sign in
  // anonymously so the app works on first launch without a sign-up screen.
  useEffect(() => {
    async function resolveUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUserId(data.user.id)
        return
      }
      const { data: signInData, error } = await supabase.auth.signInAnonymously()
      if (signInData.user) {
        setUserId(signInData.user.id)
      } else if (error) {
        setAuthError(error.message)
      }
    }
    void resolveUser()

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

    setImportError(null)
    try {
      const filePath = await window.electron.openFileDialog()
      if (!filePath) return

      // Extract metadata + file bytes in one IPC round-trip.
      const { metadata, fileBuffer } = await window.electron.importBook(filePath)

      // Upload raw bytes to Supabase Storage.
      const ext = metadata.file_type
      // Normalize to ASCII-safe slug: strip non-alphanumeric, collapse hyphens, cap length.
      const slug = metadata.title
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip diacritics
        .replace(/[^a-zA-Z0-9]+/g, '-')  // non-alphanumeric → hyphen
        .replace(/^-+|-+$/g, '')          // trim leading/trailing hyphens
        .slice(0, 80)
      const storagePath = `${userId}/${Date.now()}-${slug}.${ext}`
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
      const msg = err instanceof Error ? err.message : 'Import failed'
      setImportError(msg)
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
