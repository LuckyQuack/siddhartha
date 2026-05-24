import * as path from 'path'
import type { BookMetadata, FileType } from '../../shared/types'

// Minimal JSZip interface — jszip is a direct dep of epubjs and is always present.
interface ZipObject {
  async(type: 'text'): Promise<string>
  async(type: 'nodebuffer'): Promise<Buffer>
}
interface ZipInstance {
  file(name: string): ZipObject | null
}
interface JSZipStatic {
  loadAsync(data: Buffer): Promise<ZipInstance>
}

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

/** Extract the cover image bytes from an EPUB zip. Returns null if no cover found. */
export async function extractEpubCover(
  buffer: Buffer
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require('jszip') as JSZipStatic
    const zip = await JSZip.loadAsync(buffer)

    // Locate the OPF content document via the standard container
    const containerFile = zip.file('META-INF/container.xml')
    if (!containerFile) return null
    const containerXml = await containerFile.async('text')
    const opfPathMatch = /full-path="([^"]+)"/.exec(containerXml)
    const opfPath = opfPathMatch?.[1]
    if (!opfPath) return null

    const opfFile = zip.file(opfPath)
    if (!opfFile) return null
    const opfXml = await opfFile.async('text')

    // OPF-relative directory prefix used for resolving item hrefs
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

    function getAttr(tag: string, name: string): string | null {
      const m = new RegExp(`\\b${name}="([^"]+)"`).exec(tag)
      return m?.[1] ?? null
    }

    // Build a map of all manifest items
    const items: Array<{ id: string; href: string; mediaType: string; properties: string }> = []
    for (const m of opfXml.matchAll(/<item\b[^>]*\/?>/g)) {
      const tag = m[0]
      const href = getAttr(tag, 'href')
      if (!href) continue
      items.push({
        id: getAttr(tag, 'id') ?? '',
        href,
        mediaType: getAttr(tag, 'media-type') ?? '',
        properties: getAttr(tag, 'properties') ?? '',
      })
    }

    // EPUB3: manifest item with properties="cover-image"
    let coverItem = items.find((i) => i.properties.split(/\s+/).includes('cover-image'))

    // EPUB2: <meta name="cover" content="<item-id>"/>
    if (!coverItem) {
      const metaMatch =
        /<meta\s[^>]*name="cover"[^>]*content="([^"]+)"/.exec(opfXml) ??
        /<meta\s[^>]*content="([^"]+)"[^>]*name="cover"/.exec(opfXml)
      if (metaMatch) {
        const coverId = metaMatch[1]
        coverItem = items.find((i) => i.id === coverId)
      }
    }

    if (!coverItem?.mediaType.startsWith('image/')) return null

    const coverPath = opfDir + coverItem.href
    const coverFile = zip.file(coverPath)
    if (!coverFile) return null

    const data = await coverFile.async('nodebuffer')
    return { data, mimeType: coverItem.mediaType }
  } catch {
    return null
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
