'use client'

import * as React from 'react'
import type { Book } from '@shared/types'
import { BookCard } from './BookCard'
import type { ImportProgress } from './BookCard'

interface BookGridProps {
  books: Book[]
  onBookClick: (book: Book) => void
  importProgress?: Map<string, ImportProgress>
}

export function BookGrid({ books, onBookClick, importProgress }: BookGridProps) {
  return (
    <div className="w-full px-6 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Your Library</h1>
        <span className="text-xs text-[var(--text-muted)]">
          {books.length} {books.length === 1 ? 'book' : 'books'}
        </span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 120px))' }}>
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={onBookClick}
            importProgress={importProgress?.get(book.id)}
          />
        ))}
      </div>
    </div>
  )
}
