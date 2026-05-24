'use client'

import * as React from 'react'
import type { Book } from '@shared/types'

interface BookCardProps {
  book: Book
  onClick: (book: Book) => void
  processing?: boolean | undefined
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

export function BookCard({ book, onClick, processing = false }: BookCardProps) {
  const hue = hueFromTitle(book.title)

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
          // Generated cover: gradient with title and author text
          <div
            className="w-full h-full flex flex-col items-center justify-between p-3 select-none"
            style={{
              background: `linear-gradient(160deg, hsl(${hue},45%,28%) 0%, hsl(${hue},38%,18%) 100%)`,
            }}
          >
            {/* Top decorative rule */}
            <div className="w-full flex flex-col gap-0.5 opacity-25 pt-1">
              <div className="h-px w-full" style={{ background: `hsl(${hue},60%,75%)` }} />
              <div className="h-px w-3/4" style={{ background: `hsl(${hue},60%,75%)` }} />
            </div>

            {/* Title */}
            <p
              className="flex-1 flex items-center text-center text-xs font-serif font-semibold leading-snug line-clamp-5 px-1 py-2 pointer-events-none"
              style={{ color: `hsl(${hue},70%,88%)` }}
            >
              {book.title}
            </p>

            {/* Author + bottom rule */}
            <div className="w-full flex flex-col gap-1.5 items-center">
              {book.author && (
                <p
                  className="text-center text-[9px] font-medium tracking-wide uppercase opacity-60 w-full truncate pointer-events-none"
                  style={{ color: `hsl(${hue},55%,80%)` }}
                >
                  {book.author}
                </p>
              )}
              <div className="h-px w-full opacity-25" style={{ background: `hsl(${hue},60%,75%)` }} />
            </div>
          </div>
        )}

        {/* Subtle specular sheen on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-gradient-to-br from-white/8 to-transparent" />

        {/* Processing overlay — pulsing while upload/metadata runs in background */}
        {processing && (
          <div className="absolute inset-0 flex items-end justify-center pb-3 bg-black/40">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-amber-400"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
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
