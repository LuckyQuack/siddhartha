'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface EpubContents {
  document: Document
}

interface EpubHook {
  register(cb: (view: EpubContents) => void): void
}

interface EpubRendition {
  display(): Promise<void>
  prev(): Promise<void>
  next(): Promise<void>
  on(event: 'relocated', cb: (loc: EpubLocation) => void): void
  destroy(): void
  hooks: { content: EpubHook }
}

interface EpubLocation {
  atStart: boolean
  atEnd: boolean
}

interface EpubBook {
  ready: Promise<void>
  renderTo(el: HTMLElement, opts: { width: number; height: number; spread?: string; flow?: string }): EpubRendition
  destroy(): void
}

interface EpubReaderProps {
  url: string
}

const PAGE_STYLES = `
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
          ePubModule as { default?: (input: Blob) => EpubBook }
        ).default ?? (ePubModule as unknown as (input: Blob) => EpubBook)

        // Fetch the blob URL → pass as Blob so epub.js detects it as 'binary'
        // and unpacks it correctly. Avoids openAs: 'epub' URL-detection hacks.
        const blob = await fetch(url).then((r) => r.blob())
        if (cancelled) return

        book = ePub(blob)

        // Must await book.ready before renderTo — navigation and packaging are
        // set up asynchronously. Calling renderTo before this resolves leaves
        // book.navigation undefined, causing the crash at book.js:483.
        await book.ready
        if (cancelled) return

        const w = el.clientWidth || 800
        const h = el.clientHeight || 600

        const rendition = book.renderTo(el, { width: w, height: h, spread: 'none', flow: 'paginated' })

        rendition.hooks.content.register((view) => {
          const doc = view.document
          if (!doc?.head) return
          if (doc.getElementById('_sids')) return
          const style = doc.createElement('style')
          style.id = '_sids'
          style.textContent = PAGE_STYLES
          doc.head.appendChild(style)
        })

        renditionRef.current = rendition
        await rendition.display()
        if (cancelled) return

        rendition.on('relocated', (loc) => {
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
      <div ref={viewerRef} className="flex-1 min-h-0 overflow-hidden" />
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
