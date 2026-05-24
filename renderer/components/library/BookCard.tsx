'use client'

import * as React from 'react'
import type { Book } from '@shared/types'

interface BookCardProps {
  book: Book
  onClick: (book: Book) => void
}

// Derive a deterministic hue (0-360) from the book title so every book
// gets a unique but stable cover color when no cover art is available.
function hueFromTitle(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  const week = 7 * day
  const month = 30 * day

  if (diff < minute) return 'just now'
  if (diff < hour) return rtf.format(-Math.floor(diff / minute), 'minute')
  if (diff < day) return rtf.format(-Math.floor(diff / hour), 'hour')
  if (diff < week) return rtf.format(-Math.floor(diff / day), 'day')
  if (diff < month) return rtf.format(-Math.floor(diff / week), 'week')
  return rtf.format(-Math.floor(diff / month), 'month')
}

export function BookCard({ book, onClick }: BookCardProps) {
  const hue = hueFromTitle(book.title)
  const initial = book.title.charAt(0).toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onClick(book)}
      className="group flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
      aria-label={`Open ${book.title}`}
    >
      {/* Cover */}
      <div
        className="relative w-full rounded-lg overflow-hidden shadow-md transition-all duration-200 ease-out group-hover:shadow-xl group-hover:-translate-y-1"
        style={{ aspectRatio: '2 / 3' }}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          // Generated cover: gradient spine with title initial
          <div
            className="w-full h-full flex items-center justify-center select-none"
            style={{
              background: `linear-gradient(160deg, hsl(${hue},45%,28%) 0%, hsl(${hue},38%,18%) 100%)`,
            }}
          >
            <span
              className="text-5xl font-serif font-bold opacity-30 pointer-events-none"
              style={{ color: `hsl(${hue},60%,80%)` }}
            >
              {initial}
            </span>
          </div>
        )}

        {/* Subtle specular sheen on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-gradient-to-br from-white/8 to-transparent" />
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-tight line-clamp-2">
          {book.title}
        </p>
        {book.author && (
          <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
        )}
        {book.last_opened && (
          <p className="text-xs text-[var(--text-muted)] opacity-60 mt-0.5">
            {relativeTime(book.last_opened)}
          </p>
        )}
      </div>
    </button>
  )
}
