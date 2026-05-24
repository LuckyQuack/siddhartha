// Memory view — placeholder for step 9 (knowledge graph / timeline).
// Surfaced here so the route exists and navigation can reference it.

import { Brain } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function MemoryPage() {
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

      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
        <Brain className="w-10 h-10 opacity-30" />
        <p className="text-sm">
          Semantic memory &amp; timeline — coming in step 9.
        </p>
      </div>
    </main>
  )
}
