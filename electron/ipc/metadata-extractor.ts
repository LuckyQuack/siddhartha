import * as path from 'path'
import type { BookMetadata, FileType } from '../../shared/types'

function fileTypeFromPath(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.epub' ? 'epub' : 'pdf'
}

function titleFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ')
}

export async function extractPdfMetadata(
  filePath: string,
  buffer: Buffer
): Promise<BookMetadata> {
  try {
    // pdfjs-dist legacy build works in Node.js without a DOM.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist')
    // Disable the web worker — we're in Node.js, not a browser.
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const rawMeta = await doc.getMetadata().catch(() => null)

    const info = rawMeta?.info as Record<string, unknown> | undefined
    const title =
      typeof info?.Title === 'string' && info.Title.trim()
        ? info.Title.trim()
        : titleFromPath(filePath)
    const author =
      typeof info?.Author === 'string' && info.Author.trim()
        ? info.Author.trim()
        : null

    return {
      title,
      author,
      total_pages: doc.numPages,
      file_type: 'pdf',
      local_path: filePath,
      file_size: buffer.length,
    }
  } catch {
    return {
      title: titleFromPath(filePath),
      author: null,
      total_pages: null,
      file_type: 'pdf',
      local_path: filePath,
      file_size: buffer.length,
    }
  }
}

export async function extractEpubMetadata(
  filePath: string,
  buffer: Buffer
): Promise<BookMetadata> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const EpubModule = require('epubjs') as any
    const EpubCtor = EpubModule.default ?? EpubModule
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const book = EpubCtor(buffer.buffer as ArrayBuffer) as import('epubjs').Book
    await book.ready

    const meta = book.packaging?.metadata as unknown as Record<string, unknown> | undefined
    const title =
      typeof meta?.title === 'string' && meta.title.trim()
        ? meta.title.trim()
        : titleFromPath(filePath)
    const author =
      typeof meta?.creator === 'string' && meta.creator.trim()
        ? meta.creator.trim()
        : null

    return {
      title,
      author,
      total_pages: null, // EPUB page count requires layout engine — deferred
      file_type: 'epub',
      local_path: filePath,
      file_size: buffer.length,
    }
  } catch {
    return {
      title: titleFromPath(filePath),
      author: null,
      total_pages: null,
      file_type: 'epub',
      local_path: filePath,
      file_size: buffer.length,
    }
  }
}
