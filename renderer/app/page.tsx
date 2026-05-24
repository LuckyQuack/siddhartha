'use client'

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Book } from '@shared/types'

// Library home — the first screen the user sees.
// For now it renders an empty state with an import CTA.
// When books exist this will render a BookGrid (future step).
export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [isImporting, setIsImporting] = useState(false)

  // Listen for "File > Import Book" menu events forwarded from the main process.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return
    window.electron.onMenuEvent('import-book', () => void handleImport())
  }, [])

  async function handleImport() {
    if (isImporting) return
    setIsImporting(true)

    try {
      const filePath = await window.electron.openFileDialog()
      if (!filePath) return

      // TODO (step 3): parse the file, extract metadata, persist to Supabase.
      // For now just log to confirm the bridge is working.
      console.info('[import] selected file:', filePath)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <main className="flex flex-col min-h-screen">
      {/* Title bar — drag region so users can move the window */}
      <header className="drag-region flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="no-drag text-sm font-semibold tracking-wide text-[var(--text-secondary)] select-none">
          Siddartha
        </span>

        <div className="no-drag">
          <Button
            variant="primary"
            onClick={() => void handleImport()}
            disabled={isImporting}
          >
            {isImporting ? 'Importing…' : 'Import Book'}
          </Button>
        </div>
      </header>

      {/* Library content */}
      <section className="flex-1 flex items-center justify-center p-8">
        {books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Your library is empty"
            description="Import a PDF or EPUB to start reading. Your highlights and notes will be remembered forever."
            action={
              <Button
                variant="primary"
                onClick={() => void handleImport()}
                disabled={isImporting}
              >
                {isImporting ? 'Importing…' : 'Import your first book'}
              </Button>
            }
          />
        ) : (
          // Placeholder — BookGrid component will live here in step 3.
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {books.map((book) => (
              <li key={book.id} className="text-sm text-[var(--text-secondary)]">
                {book.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
