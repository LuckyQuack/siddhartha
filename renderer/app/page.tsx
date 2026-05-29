'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { BookGrid } from '@/components/library'
import { getBooks, createBook, updateBook } from '@/lib/db'
import { supabase } from '@/lib/db/supabase'
import type { Book } from '@shared/types'
import type { ImportProgress } from '@/components/library/BookCard'

const STORAGE_BUCKET = 'books'

function titleFromPath(filePath: string): string {
  const filename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'Unknown'
  return filename.replace(/\.(pdf|epub)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Unknown'
}

function fileTypeFromPath(filePath: string): 'pdf' | 'epub' {
  return /\.epub$/i.test(filePath) ? 'epub' : 'pdf'
}

function toStorageSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// XHR upload so we get real upload-progress events — the Supabase client
// doesn't expose them. Falls back to a plain fetch error message on failure.
async function uploadWithProgress(
  path: string,
  data: Uint8Array,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('No auth session for upload')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        let msg = xhr.responseText
        try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg } catch { /* raw text */ }
        reject(new Error(`Upload failed (${xhr.status}): ${msg}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed — network error')))
    xhr.send(data as unknown as XMLHttpRequestBodyInit)
  })
}

export default function LibraryPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [importProgress, setImportProgress] = useState<Map<string, ImportProgress>>(new Map())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function resolveUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) { setUserId(data.user.id); return }
      const { data: signInData, error } = await supabase.auth.signInAnonymously()
      if (signInData.user) setUserId(signInData.user.id)
      else if (error) setAuthError(error.message)
    }
    void resolveUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    void getBooks(userId).then(setBooks)
  }, [userId])

  function setProgress(bookId: string, progress: ImportProgress) {
    setImportProgress((prev) => new Map(prev).set(bookId, progress))
  }

  function clearProgress(bookId: string) {
    setImportProgress((prev) => { const m = new Map(prev); m.delete(bookId); return m })
  }

  const handleImport = useCallback(async () => {
    if (isDialogOpen || !userId) return
    if (typeof window === 'undefined' || !window.electron) {
      setImportError(
        'Importing only works in the desktop app. Launch it with "npm run electron:dev" — opening localhost in a browser has no file access.'
      )
      return
    }
    setIsDialogOpen(true)
    setImportError(null)

    try {
      // ── Phase 1: instant ──────────────────────────────────────────────────
      const filePath = await window.electron.openFileDialog()
      setIsDialogOpen(false)
      if (!filePath) return

      const book = await createBook({
        user_id: userId,
        title: titleFromPath(filePath),
        file_type: fileTypeFromPath(filePath),
      })
      setBooks((prev) => [book, ...prev])
      setProgress(book.id, { phase: 'extracting', pct: 0 })

      // ── Phase 2: background ───────────────────────────────────────────────
      void (async () => {
        try {
          // Extracting metadata + cover from the local file via IPC
          const { metadata, fileBuffer, coverBuffer, coverMimeType } =
            await window.electron.importBook(filePath)

          const slug = toStorageSlug(metadata.title)
          const ts = Date.now()
          const storagePath = `${userId}/${ts}-${slug}.${metadata.file_type}`
          const bookContentType =
            metadata.file_type === 'pdf' ? 'application/pdf' : 'application/epub+zip'

          setProgress(book.id, { phase: 'uploading', pct: 0 })

          // Upload book file via XHR so we get real progress events
          await uploadWithProgress(storagePath, fileBuffer, bookContentType, (pct) => {
            setProgress(book.id, { phase: 'uploading', pct })
          })

          // Upload cover via Supabase client (small file, no progress needed)
          let coverUrl: string | null = null
          if (coverBuffer && coverMimeType) {
            const coverExt = coverMimeType === 'image/png' ? 'png' : 'jpg'
            const coverPath = `${userId}/covers/${ts}-${slug}.${coverExt}`
            const { error: coverErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(coverPath, coverBuffer, { contentType: coverMimeType, upsert: false })
            if (coverErr) {
              console.warn('[import] Cover upload failed:', coverErr.message)
            } else {
              // Use a long-lived signed URL so covers work whether the bucket is
              // public or private. 1 year TTL — BookCard has an onError fallback
              // if the URL ever expires.
              const { data: signed, error: signErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(coverPath, 60 * 60 * 24 * 365)
              if (signErr) {
                console.warn('[import] Cover sign failed:', signErr.message)
              } else {
                coverUrl = signed.signedUrl
              }
            }
          }

          setProgress(book.id, { phase: 'saving', pct: 100 })

          const updated = await updateBook(book.id, {
            title: metadata.title,
            author: metadata.author,
            file_path: storagePath,
            total_pages: metadata.total_pages,
            cover_url: coverUrl,
          })
          setBooks((prev) => prev.map((b) => (b.id === book.id ? updated : b)))
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Import failed')
        } finally {
          clearProgress(book.id)
        }
      })()
    } catch (err) {
      setIsDialogOpen(false)
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [isDialogOpen, userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return
    window.electron.onMenuEvent('import-book', () => void handleImport())
  }, [handleImport])

  const handleBookClick = useCallback((book: Book) => {
    router.push(`/read/${book.id}`)
  }, [router])

  return (
    <main className="flex flex-col min-h-screen">
      <header className="drag-region flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="no-drag text-sm font-semibold tracking-wide text-[var(--text-secondary)] select-none">
          Siddhartha
        </span>
        <div className="no-drag">
          <Button variant="primary" onClick={() => void handleImport()} disabled={isDialogOpen || !userId}>
            {isDialogOpen ? 'Selecting…' : 'Import Book'}
          </Button>
        </div>
      </header>

      {authError && (
        <div className="no-drag mx-6 mt-3 px-4 py-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
          Auth error: {authError} — enable Anonymous sign-ins in Supabase dashboard → Authentication → Providers
        </div>
      )}
      {importError && (
        <div className="no-drag mx-6 mt-3 px-4 py-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          Import failed: {importError}
        </div>
      )}

      <section className="flex-1 overflow-y-auto">
        {books.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <EmptyState
              icon={BookOpen}
              title="Your library is empty"
              description="Import a PDF or EPUB to start reading. Your highlights and notes will be remembered forever."
              action={
                <Button variant="primary" onClick={() => void handleImport()} disabled={isDialogOpen || !userId}>
                  {isDialogOpen ? 'Selecting…' : 'Import your first book'}
                </Button>
              }
            />
          </div>
        ) : (
          <BookGrid books={books} onBookClick={handleBookClick} importProgress={importProgress} />
        )}
      </section>
    </main>
  )
}
