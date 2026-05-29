'use client'

import * as React from 'react'
import { useState } from 'react'
import type { Book } from '@shared/types'

export type ImportPhase = 'extracting' | 'uploading' | 'saving'
export interface ImportProgress { phase: ImportPhase; pct: number }

interface BookCardProps {
  book: Book
  onClick: (book: Book) => void
  importProgress?: ImportProgress | undefined
}

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
  const minute = 60_000, hour = 3_600_000, day = 86_400_000
  const week = 7 * day, month = 30 * day
  if (diff < minute) return 'just now'
  if (diff < hour) return rtf.format(-Math.floor(diff / minute), 'minute')
  if (diff < day) return rtf.format(-Math.floor(diff / hour), 'hour')
  if (diff < week) return rtf.format(-Math.floor(diff / day), 'day')
  if (diff < month) return rtf.format(-Math.floor(diff / week), 'week')
  return rtf.format(-Math.floor(diff / month), 'month')
}

function phaseLabel(phase: ImportPhase, pct: number): string {
  if (phase === 'extracting') return 'Reading…'
  if (phase === 'uploading') return pct > 0 ? `${pct}%` : 'Uploading…'
  return 'Saving…'
}

export function BookCard({ book, onClick, importProgress }: BookCardProps) {
  const hue = hueFromTitle(book.title)
  const processing = !!importProgress
  const [coverFailed, setCoverFailed] = useState(false)
  const showCover = !!book.cover_url && !coverFailed

  return (
    <button
      type="button"
      onClick={() => onClick(book)}
      className="group flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
      aria-label={`Open ${book.title}`}
    >
      <div
        className="relative w-full rounded-lg overflow-hidden shadow-md transition-all duration-200 ease-out group-hover:shadow-xl group-hover:-translate-y-1"
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
          <div
            className="w-full h-full flex flex-col items-center justify-between p-3 select-none"
            style={{ background: `linear-gradient(160deg, hsl(${hue},45%,28%) 0%, hsl(${hue},38%,18%) 100%)` }}
          >
            <div className="w-full flex flex-col gap-0.5 opacity-25 pt-1">
              <div className="h-px w-full" style={{ background: `hsl(${hue},60%,75%)` }} />
              <div className="h-px w-3/4" style={{ background: `hsl(${hue},60%,75%)` }} />
            </div>
            <p className="flex-1 flex items-center text-center text-xs font-serif font-semibold leading-snug line-clamp-5 px-1 py-2 pointer-events-none" style={{ color: `hsl(${hue},70%,88%)` }}>
              {book.title}
            </p>
            <div className="w-full flex flex-col gap-1.5 items-center">
              {book.author && (
                <p className="text-center text-[9px] font-medium tracking-wide uppercase opacity-60 w-full truncate pointer-events-none" style={{ color: `hsl(${hue},55%,80%)` }}>
                  {book.author}
                </p>
              )}
              <div className="h-px w-full opacity-25" style={{ background: `hsl(${hue},60%,75%)` }} />
            </div>
          </div>
        )}

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-gradient-to-br from-white/8 to-transparent" />

        {processing && importProgress && (
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/60 pointer-events-none">
            <span className="text-[11px] font-semibold text-white/90 mb-2 tabular-nums">
              {phaseLabel(importProgress.phase, importProgress.pct)}
            </span>
            <div className="w-3/4 h-1 bg-white/20 rounded-full overflow-hidden mb-4">
              {importProgress.phase === 'uploading' ? (
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress.pct}%` }}
                />
              ) : (
                <div className="h-full bg-amber-400 rounded-full animate-pulse" style={{ width: '40%' }} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-tight line-clamp-2">{book.title}</p>
        {book.author && <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>}
        {book.last_opened && (
          <p className="text-xs text-[var(--text-muted)] opacity-60 mt-0.5">{relativeTime(book.last_opened)}</p>
        )}
      </div>
    </button>
  )
}
