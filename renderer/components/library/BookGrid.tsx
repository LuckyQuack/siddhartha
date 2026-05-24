'use client'

import * as React from 'react'
import type { Book } from '@shared/types'
import { BookCard } from './BookCard'

interface BookGridProps {
  books: Book[]
  onBookClick: (book: Book) => void
  processingIds?: Set<string>
}

export function BookGrid({ books, onBookClick, processingIds }: BookGridProps) {
  return (
    <div className="w-full px-6 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
          Your Library
        </h1>
        <span className="text-xs text-[var(--text-muted)]">
          {books.length} {books.length === 1 ? 'book' : 'books'}
        </span>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={onBookClick}
            processing={processingIds?.has(book.id)}
          />
        ))}
      </div>
    </div>
  )
}
