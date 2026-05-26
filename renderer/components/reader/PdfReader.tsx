'use client'

import { useEffect, useRef, useState } from 'react'

interface PdfReaderProps {
  url: string
}

export function PdfReader({ url }: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState<{ rendered: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          canvas.style.cssText =
            'display:block;margin:0 auto 16px;border-radius:4px;box-shadow:0 2px 16px rgba(0,0,0,0.5);max-width:100%'

          await page.render({ canvasContext: ctx, viewport }).promise

          if (!cancelled) {
            el.appendChild(canvas)
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
    </div>
  )
}
