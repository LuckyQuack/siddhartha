import * as path from 'path'
import type { BookMetadata } from '../../shared/types'

// ─── Minimal JSZip interface ───────────────────────────────────────────────────
// jszip is a direct dep of epubjs and is always hoisted to top-level node_modules.
interface ZipObject {
  async(type: 'text'): Promise<string>
  async(type: 'nodebuffer'): Promise<Buffer>
  dir: boolean
}
interface ZipInstance {
  file(name: string): ZipObject | null
  files: Record<string, ZipObject>
}
interface JSZipStatic {
  loadAsync(data: Buffer): Promise<ZipInstance>
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function titleFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ')
}

function zipFile(zip: ZipInstance, name: string): ZipObject | null {
  const exact = zip.file(name)
  if (exact) return exact
  const lower = name.toLowerCase()
  const match = Object.keys(zip.files).find((k) => k.toLowerCase() === lower)
  return match ? (zip.files[match] ?? null) : null
}

function resolveZipPath(href: string, opfDir: string): string {
  const decoded = decodeURIComponent(href)
  if (decoded.startsWith('/')) return decoded.slice(1)
  const parts = (opfDir + decoded).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.') out.push(p)
  }
  return out.join('/')
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif)$/i
const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
}

// ─── EPUB ──────────────────────────────────────────────────────────────────────

export interface EpubInfo {
  metadata: BookMetadata
  cover: { data: Buffer; mimeType: string } | null
}

/**
 * Single JSZip pass: extracts title, author, and cover from an EPUB.
 *
 * Previously this used epubjs (extractEpubMetadata) + JSZip (extractEpubCover)
 * in two separate passes. epubjs runs in the Electron main process (Node.js,
 * no DOM), where epub.js's internal `book.ready` Promise can stall permanently
 * if any browser API it relies on is absent. That caused the infinite hang.
 *
 * JSZip is pure Node.js with no browser dependencies — it cannot hang.
 */
export async function extractEpubInfo(
  filePath: string,
  buffer: Buffer
): Promise<EpubInfo> {
  const fallback: EpubInfo = {
    metadata: {
      title: titleFromPath(filePath),
      author: null,
      total_pages: null,
      file_type: 'epub',
      local_path: filePath,
      file_size: buffer.length,
    },
    cover: null,
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require('jszip') as JSZipStatic
    const zip = await JSZip.loadAsync(buffer)

    // ── Locate OPF ─────────────────────────────────────────────────────────────
    const containerFile = zipFile(zip, 'META-INF/container.xml')
    if (!containerFile) return fallback

    const containerXml = await containerFile.async('text')
    const opfPathRaw = /full-path="([^"]+)"/.exec(containerXml)?.[1]
    if (!opfPathRaw) return fallback

    const opfFile = zipFile(zip, opfPathRaw)
    if (!opfFile) return fallback

    const opfXml = await opfFile.async('text')
    const opfDir = opfPathRaw.includes('/')
      ? opfPathRaw.slice(0, opfPathRaw.lastIndexOf('/') + 1)
      : ''

    // ── Metadata ───────────────────────────────────────────────────────────────
    const title =
      /<dc:title\b[^>]*>([^<]+)<\/dc:title>/i.exec(opfXml)?.[1]?.trim() ||
      titleFromPath(filePath)
    const author =
      /<dc:creator\b[^>]*>([^<]+)<\/dc:creator>/i.exec(opfXml)?.[1]?.trim() ||
      null

    // ── Cover image ────────────────────────────────────────────────────────────
    function getAttr(tag: string, attrName: string): string | null {
      return new RegExp(`\\b${attrName}="([^"]+)"`).exec(tag)?.[1] ?? null
    }

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

    // EPUB3: properties="cover-image"
    let coverItem = items.find((i) => i.properties.split(/\s+/).includes('cover-image'))

    // EPUB2: <meta name="cover" content="<item-id>"/>
    if (!coverItem) {
      const metaMatch =
        /<meta\s[^>]*name="cover"[^>]*content="([^"]+)"/.exec(opfXml) ??
        /<meta\s[^>]*content="([^"]+)"[^>]*name="cover"/.exec(opfXml)
      if (metaMatch) coverItem = items.find((i) => i.id === metaMatch[1])
    }

    let cover: { data: Buffer; mimeType: string } | null = null

    if (coverItem?.mediaType.startsWith('image/')) {
      const f = zipFile(zip, resolveZipPath(coverItem.href, opfDir))
      if (f) cover = { data: await f.async('nodebuffer'), mimeType: coverItem.mediaType }
    }

    // Fallback: any file with "cover" in its name
    if (!cover) {
      const byName = Object.keys(zip.files).find((n) => {
        const f = zip.files[n]
        return f && !f.dir && n.toLowerCase().includes('cover') && IMAGE_EXT.test(n)
      })
      if (byName) {
        const ext = byName.split('.').pop()?.toLowerCase() ?? ''
        const f = zip.files[byName]
        if (f) cover = { data: await f.async('nodebuffer'), mimeType: IMAGE_MIME[ext] ?? 'image/jpeg' }
      }
    }

    // Fallback: first image in the zip
    if (!cover) {
      const firstImage = Object.keys(zip.files).find((n) => {
        const f = zip.files[n]
        return f && !f.dir && IMAGE_EXT.test(n)
      })
      if (firstImage) {
        const ext = firstImage.split('.').pop()?.toLowerCase() ?? ''
        const f = zip.files[firstImage]
        if (f) cover = { data: await f.async('nodebuffer'), mimeType: IMAGE_MIME[ext] ?? 'image/jpeg' }
      }
    }

    // Normalize cover to 400×600 JPEG so every card in the library grid
    // displays at a consistent resolution regardless of the source image size.
    if (cover) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sharp = require('sharp') as typeof import('sharp')
        cover = {
          data: await sharp(cover.data)
            .resize(400, 600, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 85 })
            .toBuffer(),
          mimeType: 'image/jpeg',
        }
      } catch {
        // sharp unavailable — keep original
      }
    }

    return {
      metadata: {
        title,
        author,
        total_pages: null, // EPUB page count requires a layout engine — not worth it here
        file_type: 'epub',
        local_path: filePath,
        file_size: buffer.length,
      },
      cover,
    }
  } catch {
    return fallback
  }
}

// ─── PDF ───────────────────────────────────────────────────────────────────────

/**
 * Extracts title, author, and page count from a PDF buffer without loading
 * pdfjs-dist or any other rendering library.
 *
 * Previously this used pdfjs-dist, which stalls permanently in Node.js
 * (no DOM) because its internal Promise chain relies on browser APIs.
 *
 * PDF Info dictionary entries are plain ASCII inside the binary — we scan
 * the first and last 64 KB where they almost always appear. Page count is
 * read from the /Count entry in the Pages tree root.
 */
export function extractPdfMetadata(filePath: string, buffer: Buffer): BookMetadata {
  // Read the regions where the Info dict and Pages tree typically live.
  const chunkSize = 65536
  const head = buffer.toString('latin1', 0, Math.min(buffer.length, chunkSize))
  const tail = buffer.toString('latin1', Math.max(0, buffer.length - chunkSize))
  const text = head + tail

  const title = readPdfString(text, 'Title') ?? titleFromPath(filePath)
  const author = readPdfString(text, 'Author')
  const totalPages = readPdfPageCount(text)

  return {
    title,
    author,
    total_pages: totalPages,
    file_type: 'pdf',
    local_path: filePath,
    file_size: buffer.length,
  }
}

function readPdfString(text: string, key: string): string | null {
  // Matches /Key (literal string). Handles simple PDF escape sequences.
  // Does not handle hex-encoded or UTF-16BE values (rare in Info dicts).
  const m = new RegExp(`/${key}\\s*\\(([^)\\\\]*(?:\\\\.[^)\\\\]*)*)\\)`).exec(text)
  if (!m || !m[1]) return null
  const val = m[1].replace(/\\n/g, ' ').replace(/\\(.)/g, '$1').trim()
  return val || null
}

function readPdfPageCount(text: string): number | null {
  // /Count N appears in the Pages dictionary (the root of the page tree).
  // The first occurrence is usually the document total.
  const m = /\/Count\s+(\d+)/.exec(text)
  if (!m || !m[1]) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
