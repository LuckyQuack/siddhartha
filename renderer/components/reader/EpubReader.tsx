'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface EpubReaderProps {
  url: string
}

// epubjs types (subset we use)
interface EpubContents {
  document: Document
}
interface EpubHook {
  register(cb: (view: EpubContents) => void): void
}
interface EpubRendition {
  display(target?: string): Promise<void>
  prev(): Promise<void>
  next(): Promise<void>
  on(event: string, cb: (loc: EpubLocation) => void): void
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

export function EpubReader({ url }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const locationRef = useRef<string | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        // Pre-fetch as ArrayBuffer so epubjs treats it as binary and unpacks
        // correctly — blob: URLs fail epubjs's URL type detection.
        const data = await fetch(url).then((r) => r.arrayBuffer())
        if (cancelled) return

        book = ePub(data)

        // Wait for navigation (TOC) to be parsed — epubjs pattern from react-reader.
        // This ensures spine, navigation and packaging are ready before renderTo.
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
          if (!doc?.head || doc.getElementById('_sids')) return
          const style = doc.createElement('style')
          style.id = '_sids'
          style.textContent = CONTENT_STYLES
          doc.head.appendChild(style)
        })

        renditionRef.current = rendition

        // Resume at last position or start from beginning
        await rendition.display(locationRef.current ?? undefined)
        if (cancelled) return

        rendition.on('relocated', (loc: EpubLocation) => {
          locationRef.current = loc.start.cfi
          setAtStart(loc.atStart)
          setAtEnd(loc.atEnd)
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

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
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
  )
}
