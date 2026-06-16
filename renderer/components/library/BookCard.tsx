'use client'

import * as React from 'react'
import { useState } from 'react'
import type { Book } from '@shared/types'

export type ImportPhase = 'extracting' | 'saving'
export interface ImportProgress { phase: ImportPhase; pct: number }

interface BookCardProps {
  book: Book
  onClick: (book: Book) => void
  importProgress?: ImportProgress | undefined
}

function hueFromTitle(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const m = 60_000, h = 3_600_000, d = 86_400_000
  if (diff < m) return 'just now'
  if (diff < h)  return rtf.format(-Math.floor(diff / m), 'minute')
  if (diff < d)  return rtf.format(-Math.floor(diff / h), 'hour')
  if (diff < 7 * d) return rtf.format(-Math.floor(diff / d), 'day')
  return rtf.format(-Math.floor(diff / (30 * d)), 'month')
}

export function BookCard({ book, onClick, importProgress }: BookCardProps) {
  const hue = hueFromTitle(book.title)
  const [coverFailed, setCoverFailed] = useState(false)
  const showCover = !!book.cover_url && !coverFailed
  const processing = !!importProgress

  return (
    <button
      type="button"
      onClick={() => onClick(book)}
      disabled={processing}
      className="group flex flex-col gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] rounded-sm disabled:cursor-default"
      aria-label={`Open ${book.title}`}
    >
      {/* Cover */}
      <div
        className="relative w-full rounded-sm overflow-hidden shadow-md transition-all duration-200 group-hover:shadow-xl group-hover:-translate-y-0.5"
        style={{ aspectRatio: '2 / 3' }}
      >
        {showCover ? (
          <img
            src={book.cover_url!}
            alt={book.title}
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setCoverFailed(true)}
          />
        ) : (
          /* Spine-style placeholder */
          <div
            className="w-full h-full flex flex-col justify-between p-3"
            style={{
              background: `linear-gradient(165deg, hsl(${hue},28%,82%) 0%, hsl(${hue},22%,70%) 100%)`,
            }}
          >
            <div className="w-5 h-0.5 rounded-full opacity-40" style={{ background: `hsl(${hue},30%,40%)` }} />
            <div className="flex flex-col gap-1.5">
              <p
                className="font-display text-[11px] font-semibold leading-tight line-clamp-4 text-center"
                style={{ color: `hsl(${hue},35%,20%)` }}
              >
                {book.title}
              </p>
              {book.author && (
                <p
                  className="text-[8px] font-serif text-center uppercase tracking-widest opacity-60 truncate"
                  style={{ color: `hsl(${hue},25%,25%)` }}
                >
                  {book.author}
                </p>
              )}
            </div>
            <div className="w-5 h-0.5 rounded-full opacity-40 self-end" style={{ background: `hsl(${hue},30%,40%)` }} />
          </div>
        )}

        {/* Hover sheen */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-gradient-to-br from-white/10 to-transparent" />

        {/* Import progress overlay */}
        {processing && importProgress && (
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-parchment-100/80 backdrop-blur-sm pointer-events-none">
            <span className="text-[10px] font-serif font-semibold text-[var(--text-secondary)] mb-2">
              {importProgress.phase === 'extracting' ? 'Reading…' : 'Saving…'}
            </span>
            <div className="w-3/4 h-0.5 bg-[var(--border-soft)] rounded-full overflow-hidden mb-4">
              <div className="h-full bg-[var(--accent-teal)] rounded-full animate-pulse" style={{ width: '50%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="font-display text-[13px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">
          {book.title}
        </p>
        {book.author && (
          <p className="font-serif text-[11px] text-[var(--text-muted)] truncate italic">{book.author}</p>
        )}
        {book.last_opened && (
          <p className="font-serif text-[10px] text-[var(--text-muted)] opacity-70 mt-0.5">
            {relativeTime(book.last_opened)}
          </p>
        )}
      </div>
    </button>
  )
}
