'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createHighlight } from '@/lib/db/supabase-highlights'
import { extractContext, scrollPositionPct } from '@/lib/reader/context'

interface EpubReaderProps {
  url: string
  bookId: string
  userId: string
}

// epubjs types (subset we use)
interface EpubContents {
  document: Document
  window: Window
}
interface EpubHook {
  register(cb: (view: EpubContents) => void): void
}
interface EpubRendition {
  display(target?: string): Promise<void>
  prev(): Promise<void>
  next(): Promise<void>
  on(event: string, cb: (...args: unknown[]) => void): void
  destroy(): void
  hooks: { content: EpubHook }
}
interface EpubLocation {
  start: { cfi: string }
  atStart: boolean
  atEnd: boolean
}
interface EpubBook {
  loaded: { navigation: Promise<void> }
  renderTo(
    el: HTMLElement,
    opts: { width: number | string; height: number | string; spread?: string; flow?: string; manager?: string }
  ): EpubRendition
  destroy(): void
}

const CONTENT_STYLES = `
  html, body {
    background-color: #ffffff !important;
    color: #1a1a1a !important;
  }
  img, svg, image {
    max-width: 100% !important;
    max-height: 100vh !important;
    height: auto !important;
  }
  body { margin: 0 !important; padding: 0 1.5rem !important; box-sizing: border-box; }
`

type PendingHighlight = {
  selectedText: string
  contextBefore: string
  contextAfter: string
  positionPct: number
}

export function EpubReader({ url, bookId, userId }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const locationRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const pendingRef = useRef<PendingHighlight | null>(null)

  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSelection, setPendingSelection] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const el = viewerRef.current
    if (!el) return

    let cancelled = false
    let book: EpubBook | null = null

    async function init() {
      try {
        const ePubModule = await import('epubjs')
        const ePub = (
          ePubModule as unknown as { default?: (input: ArrayBuffer) => EpubBook }
        ).default ?? (ePubModule as unknown as (input: ArrayBuffer) => EpubBook)

        const data = await fetch(url).then((r) => r.arrayBuffer())
        if (cancelled) return

        book = ePub(data)

        await book.loaded.navigation
        if (cancelled || !el) return

        const w = el.clientWidth || 800
        const h = el.clientHeight || 600

        const rendition = book.renderTo(el, {
          width: w,
          height: h,
          spread: 'none',
          manager: 'continuous',
          flow: 'scrolled',
        })

        rendition.hooks.content.register((view) => {
          const doc = view.document
          if (!doc?.head) return

          // Inject styles once per view (guard against double-registration)
          if (!doc.getElementById('_sids')) {
            const style = doc.createElement('style')
            style.id = '_sids'
            style.textContent = CONTENT_STYLES
            doc.head.appendChild(style)
          }

          // mouseup on the inner document is the most reliable way to detect
          // selection in epubjs. We pair it with the external sidebar so there
          // is no z-index / iframe-compositing fight.
          doc.addEventListener('mouseup', () => {
            const selection = doc.getSelection()
            console.log('[highlight] mouseup fired, selection:', selection?.toString())

            if (!selection || selection.isCollapsed) {
              setPendingSelection(false)
              return
            }
            const text = selection.toString().trim()
            if (text.length < 5) {
              setPendingSelection(false)
              return
            }

            const range = selection.getRangeAt(0)
            const { contextBefore, contextAfter } = extractContext(range)

            pendingRef.current = {
              selectedText: text,
              contextBefore,
              contextAfter,
              positionPct: scrollPositionPct(el),
            }
            console.log('[highlight] pending set, showing sidebar')
            setPendingSelection(true)
          })
        })

        renditionRef.current = rendition

        await rendition.display(locationRef.current ?? undefined)
        if (cancelled) return

        rendition.on('relocated', (loc: unknown) => {
          const typedLoc = loc as EpubLocation
          locationRef.current = typedLoc.start.cfi
          setAtStart(typedLoc.atStart)
          setAtEnd(typedLoc.atEnd)
        })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load EPUB')
      }
    }

    void init()

    return () => {
      cancelled = true
      renditionRef.current?.destroy()
      renditionRef.current = null
      book?.destroy()
      el.innerHTML = ''
    }
  }, [url])

  async function handleHighlight() {
    console.log('[highlight] save clicked, pending:', pendingRef.current)
    const data = pendingRef.current
    if (!data) return

    setPendingSelection(false)
    pendingRef.current = null
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
    } catch (e) {
      console.error('Failed to save highlight', e)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Reader content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={viewerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" />
        <div className="flex items-center justify-between px-8 py-3 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => void renditionRef.current?.prev()}
            disabled={atStart}
            className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-xs text-[var(--text-muted)]">Select text to highlight</span>
          <button
            type="button"
            onClick={() => void renditionRef.current?.next()}
            disabled={atEnd}
            className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Highlight action panel — rendered outside the iframe area, no z-index fight */}
      <div
        className={`
          flex flex-col items-center justify-center w-16 border-l border-white/5 shrink-0
          transition-all duration-200
          ${pendingSelection ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <button
          type="button"
          onClick={() => void handleHighlight()}
          disabled={saving || !pendingSelection}
          title="Highlight selection"
          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg text-[var(--accent-highlight)] hover:bg-[var(--accent-highlight-bg)] transition-colors disabled:opacity-40"
        >
          <span className="text-lg leading-none">✦</span>
          <span className="text-[10px] font-medium leading-none">
            {saving ? '…' : 'Save'}
          </span>
        </button>
      </div>
    </div>
  )
}
