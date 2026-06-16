'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createHighlight } from '@/lib/db'
import { extractContext, scrollPositionPct } from '@/lib/reader/context'
import { parseEpub } from '@/lib/reader/epub-html'
import type { EpubChapter } from '@/lib/reader/epub-html'
import { SelectionToolbar } from './SelectionToolbar'

interface EpubReaderProps {
  url: string
  bookId: string
  userId: string
}

type PendingHighlight = {
  selectedText: string
  contextBefore: string
  contextAfter: string
  positionPct: number
}

export function EpubReader({ url, bookId, userId }: EpubReaderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const blobUrlsRef = useRef<string[]>([])
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const pendingRef = useRef<PendingHighlight | null>(null)

  const [chapters, setChapters] = useState<EpubChapter[]>([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const urls = blobUrlsRef.current
    parseEpub(url, urls)
      .then((chs) => { setChapters(chs); setLoading(false) })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load EPUB')
        setLoading(false)
      })
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls.length = 0 }
  }, [url])

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [chapterIndex])

  // Use document-level listener so selection that ends outside the container still works
  useEffect(() => {
    function onMouseUp() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setToolbarRect(null)
        return
      }

      const text = selection.toString().trim()
      if (text.length < 5) { setToolbarRect(null); return }

      const range = selection.getRangeAt(0)

      // Only act when the selection lives inside the reading area
      const container = scrollContainerRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setToolbarRect(null)
        return
      }

      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) { setToolbarRect(null); return }

      let contextBefore = ''
      let contextAfter = ''
      try {
        const ctx = extractContext(range)
        contextBefore = ctx.contextBefore
        contextAfter = ctx.contextAfter
      } catch { /* context extraction is best-effort */ }

      pendingRef.current = {
        selectedText: text,
        contextBefore,
        contextAfter,
        positionPct: scrollPositionPct(container),
      }
      setToolbarRect(new DOMRect(rect.x, rect.y, rect.width, rect.height))
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  async function handleHighlight() {
    const data = pendingRef.current
    if (!data) return
    setToolbarRect(null)
    pendingRef.current = null
    window.getSelection()?.removeAllRanges()
    setSaving(true)
    try {
      await createHighlight({
        user_id: userId,
        book_id: bookId,
        selected_text: data.selectedText,
        context_before: data.contextBefore,
        context_after: data.contextAfter,
        position_pct: data.positionPct,
        session_id: sessionIdRef.current,
      })
    } finally {
      setSaving(false)
    }
  }

  function dismissToolbar() {
    setToolbarRect(null)
    pendingRef.current = null
    window.getSelection()?.removeAllRanges()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-serif text-sm text-[var(--text-muted)] italic">Opening book…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="font-serif text-sm text-red-600 text-center">{error}</p>
      </div>
    )
  }

  const chapter = chapters[chapterIndex]
  const atStart = chapterIndex === 0
  const atEnd = chapterIndex === chapters.length - 1

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)]">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <article
          className="mx-auto px-8 py-12"
          style={{ maxWidth: '65ch', userSelect: 'text' }}
          dangerouslySetInnerHTML={{ __html: chapter?.html ?? '' }}
        />
      </div>

      <div className="flex items-center justify-between px-8 py-3 border-t border-[var(--border-subtle)] shrink-0 bg-[var(--surface-raised)]">
        <button
          type="button"
          onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
          disabled={atStart}
          className="flex items-center gap-1.5 font-serif text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="font-serif text-xs text-[var(--text-muted)] italic">
          {chapterIndex + 1} / {chapters.length}
        </span>
        <button
          type="button"
          onClick={() => setChapterIndex((i) => Math.min(chapters.length - 1, i + 1))}
          disabled={atEnd}
          className="flex items-center gap-1.5 font-serif text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {toolbarRect && (
        <SelectionToolbar
          rect={toolbarRect}
          onHighlight={() => void handleHighlight()}
          onDismiss={dismissToolbar}
          saving={saving}
        />
      )}
    </div>
  )
}
