'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getBook, touchLastOpened } from '@/lib/db'
import type { Book } from '@shared/types'
import { PdfReader } from '@/components/reader/PdfReader'
import { EpubReader } from '@/components/reader/EpubReader'

interface ReaderPageProps {
  params: { bookId: string }
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const [book, setBook] = useState<Book | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        if (typeof window === 'undefined' || !window.api || !window.electron) {
          setError('Reader requires the desktop app')
          return
        }

        const uid = await window.api.user.getOrCreateId()
        setUserId(uid)

        const record = await getBook(params.bookId, uid)
        if (!record) {
          setError('Book not found')
          return
        }
        setBook(record)

        if (!record.file_path) {
          setError('File path missing — try re-importing the book')
          return
        }

        void touchLastOpened(record.id, uid)

        // Read the local file via IPC and create a blob URL for the reader.
        const buffer = await window.electron.readFile(record.file_path)
        const mimeType =
          record.file_type === 'pdf' ? 'application/pdf' : 'application/epub+zip'
        const blob = new Blob([new Uint8Array(buffer)], { type: mimeType })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setFileUrl(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load book')
      }
    }

    void load()

    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [params.bookId])

  return (
    <main className="flex flex-col h-screen overflow-hidden bg-[var(--surface-base)]">
      <header className="drag-region flex items-center gap-4 px-6 py-3 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--surface-raised)]">
        <Link
          href="/"
          className="no-drag flex items-center gap-1.5 font-serif text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Library
        </Link>
        {book && (
          <>
            <div className="h-3.5 w-px bg-[var(--border-subtle)]" />
            <span className="font-serif text-sm text-[var(--text-primary)] truncate">{book.title}</span>
            {book.author && (
              <span className="font-serif text-sm text-[var(--text-muted)] italic truncate hidden sm:block">
                {book.author}
              </span>
            )}
          </>
        )}
      </header>

      {error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="font-serif text-sm text-red-600 text-center">{error}</p>
        </div>
      ) : !fileUrl || !userId || !book ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-serif text-sm text-[var(--text-muted)] italic">Loading…</p>
        </div>
      ) : book.file_type === 'pdf' ? (
        <PdfReader url={fileUrl} bookId={book.id} userId={userId} />
      ) : (
        <EpubReader url={fileUrl} bookId={book.id} userId={userId} />
      )}
    </main>
  )
}
