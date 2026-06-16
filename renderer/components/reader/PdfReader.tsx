'use client'

import { useEffect, useRef, useState } from 'react'
import { createHighlight } from '@/lib/db/supabase-highlights'
import { extractContext, scrollPositionPct } from '@/lib/reader/context'
import { HighlightTooltip } from './HighlightTooltip'

interface PdfReaderProps {
  url: string
  bookId: string
  userId: string
}

type PendingHighlight = {
  selectedText: string
  contextBefore: string
  contextAfter: string
  positionPct: number
  pageNumber: number
}

export function PdfReader({ url, bookId, userId }: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const pendingRef = useRef<PendingHighlight | null>(null)

  const [progress, setProgress] = useState<{ rendered: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const el = container
    let cancelled = false

    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

        const pdf = await pdfjs.getDocument({ url }).promise
        if (cancelled) return

        setProgress({ rendered: 0, total: pdf.numPages })

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break

          const page = await pdf.getPage(pageNum)
          const naturalViewport = page.getViewport({ scale: 1 })
          const containerWidth = el.clientWidth - 32
          const scale = Math.min(containerWidth / naturalViewport.width, 2.5)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.cssText = 'position:absolute;top:0;left:0;border-radius:4px;box-shadow:0 2px 16px rgba(0,0,0,0.5);'

          await page.render({ canvasContext: ctx, viewport }).promise

          // Text layer enables text selection
          const textLayerDiv = document.createElement('div')
          textLayerDiv.className = 'pdf-text-layer'

          try {
            const textContent = await page.getTextContent()
            // renderTextLayer is exported from pdfjs-dist v4
            const renderFn = (pdfjs as unknown as { renderTextLayer?: (p: object) => { promise: Promise<void> } }).renderTextLayer
            if (renderFn) {
              const task = renderFn({ textContentSource: textContent, container: textLayerDiv, viewport })
              await task.promise
            }
          } catch {
            // text layer is best-effort — proceed without it
          }

          // Page wrapper positions canvas + text layer together
          const pageWrapper = document.createElement('div')
          pageWrapper.dataset.pageNumber = String(pageNum)
          pageWrapper.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto 16px;`

          pageWrapper.appendChild(canvas)
          pageWrapper.appendChild(textLayerDiv)

          if (!cancelled) {
            el.appendChild(pageWrapper)
            setProgress({ rendered: pageNum, total: pdf.numPages })
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load PDF')
      }
    }

    void render()
    return () => {
      cancelled = true
      el.innerHTML = ''
    }
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleMouseUp() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      const text = selection.toString().trim()
      if (text.length < 5) return

      const range = selection.getRangeAt(0)
      const { contextBefore, contextAfter } = extractContext(range)
      const selRect = range.getBoundingClientRect()

      // Determine which page wrapper the selection starts in
      let pageNumber = 1
      let node: Node | null = range.startContainer
      while (node && node !== el) {
        if (node instanceof HTMLElement && node.dataset.pageNumber) {
          pageNumber = parseInt(node.dataset.pageNumber, 10)
          break
        }
        node = node.parentElement
      }

      const TOOLTIP_W = 130
      const GAP = 12
      const rightX = selRect.right + GAP
      const x = rightX + TOOLTIP_W > window.innerWidth
        ? selRect.left - TOOLTIP_W - GAP
        : rightX
      const y = selRect.top + selRect.height / 2

      pendingRef.current = {
        selectedText: text,
        contextBefore,
        contextAfter,
        // containerRef.current is non-null when this listener fires
        positionPct: scrollPositionPct(containerRef.current!),
        pageNumber,
      }
      setTooltipPos({ x, y })
    }

    el.addEventListener('mouseup', handleMouseUp)
    return () => el.removeEventListener('mouseup', handleMouseUp)
  }, [])

  async function handleHighlight() {
    const data = pendingRef.current
    if (!data) return

    setTooltipPos(null)
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
        page_number: data.pageNumber,
        session_id: sessionIdRef.current,
      })
    } catch (e) {
      console.error('Failed to save highlight', e)
    } finally {
      setSaving(false)
    }
  }

  function dismissTooltip() {
    setTooltipPos(null)
    pendingRef.current = null
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {progress && progress.rendered < progress.total && (
        <div className="px-6 py-2 text-xs text-[var(--text-muted)] border-b border-white/5 shrink-0">
          Rendering page {progress.rendered} of {progress.total}…
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ background: '#1c1c1c' }}
      />
      {tooltipPos && (
        <HighlightTooltip
          position={tooltipPos}
          onHighlight={() => void handleHighlight()}
          onDismiss={dismissTooltip}
          saving={saving}
        />
      )}
    </div>
  )
}
