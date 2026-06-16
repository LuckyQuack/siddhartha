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
    <div className="px-8 py-8">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
          Your Library
        </h1>
        <span className="font-serif text-xs text-[var(--text-muted)] italic">
          {books.length} {books.length === 1 ? 'volume' : 'volumes'}
        </span>
      </div>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 150px))' }}
      >
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
