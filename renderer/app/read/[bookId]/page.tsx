// Reader view — placeholder for step 4.
// This route will render the PDF/EPUB reader with highlight capture.

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ReaderPageProps {
  params: { bookId: string }
}

export default function ReaderPage({ params }: ReaderPageProps) {
  return (
    <main className="flex flex-col min-h-screen">
      <header className="drag-region flex items-center gap-4 px-6 py-4 border-b border-white/5">
        <Link
          href="/"
          className="no-drag flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Library
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        <p className="text-sm">
          Reader for book <code className="font-mono">{params.bookId}</code> — coming in step 4.
        </p>
      </div>
    </main>
  )
}
