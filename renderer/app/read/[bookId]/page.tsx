'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/db/supabase'
import { getBook, updateLastOpened } from '@/lib/db'
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not signed in'); return }

        setUserId(user.id)

        const record = await getBook(params.bookId, user.id)
        if (!record) { setError('Book not found'); return }
        setBook(record)

        if (!record.file_path) {
          setError('File still uploading — wait a moment and try again')
          return
        }

        void updateLastOpened(record.id)

        const { data: blob, error: dlErr } = await supabase.storage
          .from('books')
          .download(record.file_path)

        if (dlErr) throw new Error(dlErr.message)

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
    <main className="flex flex-col h-screen overflow-hidden">
      <header className="drag-region flex items-center gap-4 px-6 py-4 border-b border-white/5 shrink-0">
        <Link
          href="/"
          className="no-drag flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Library
        </Link>
        {book && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-sm text-[var(--text-primary)] truncate">{book.title}</span>
            {book.author && (
              <span className="text-sm text-[var(--text-muted)] truncate hidden sm:block">
                — {book.author}
              </span>
            )}
          </>
        )}
      </header>

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-400 text-center px-6">{error}</p>
        </div>
      ) : !fileUrl || !userId || !book ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </div>
      ) : book.file_type === 'pdf' ? (
        <PdfReader url={fileUrl} bookId={book.id} userId={userId} />
      ) : (
        <EpubReader url={fileUrl} bookId={book.id} userId={userId} />
      )}
    </main>
  )
}
