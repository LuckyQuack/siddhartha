/**
 * @jest-environment node
 *
 * Tests for extractEpubInfo — the unified JSZip-based EPUB metadata + cover
 * extractor that replaced the old epubjs (extractEpubMetadata) + JSZip
 * (extractEpubCover) two-pass approach.
 *
 * The old epubjs approach caused an infinite hang in Electron's main process
 * because epub.js's book.ready Promise relies on browser APIs (fetch,
 * requestAnimationFrame, document) that don't exist in Node.js — the Promise
 * chain breaks silently and never settles.
 */

import JSZip from 'jszip'
import { extractEpubInfo } from '../electron/ipc/metadata-extractor'

async function buildMinimalEpub(opts: {
  title?: string
  author?: string
  coverData?: Buffer
  coverStrategy?: 'epub3' | 'epub2' | 'filename' | 'none'
}): Promise<Buffer> {
  const { title = 'Test Book', author = 'Test Author', coverData, coverStrategy = 'epub3' } = opts
  const zip = new JSZip()

  zip.file('mimetype', 'application/epub+zip')
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:schemas:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  const coverItemXml = coverData
    ? coverStrategy === 'epub3'
      ? `<item id="cover-img" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>`
      : coverStrategy === 'epub2'
      ? `<item id="cover-img" href="cover.jpg" media-type="image/jpeg"/>`
      : ''
    : ''

  const metaXml = coverData && coverStrategy === 'epub2'
    ? `<meta name="cover" content="cover-img"/>`
    : ''

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${coverStrategy === 'epub3' ? '3.0' : '2.0'}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    ${metaXml}
  </metadata>
  <manifest>
    ${coverItemXml}
  </manifest>
</package>`)

  if (coverData) {
    const coverName = coverStrategy === 'filename' ? 'OEBPS/cover-image.jpg' : 'OEBPS/cover.jpg'
    zip.file(coverName, coverData)
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}

const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

describe('extractEpubInfo', () => {
  it('extracts title and author from OPF dc:title / dc:creator', async () => {
    const buf = await buildMinimalEpub({ title: 'Dune', author: 'Frank Herbert' })
    const { metadata } = await extractEpubInfo('/books/dune.epub', buf)
    expect(metadata.title).toBe('Dune')
    expect(metadata.author).toBe('Frank Herbert')
    expect(metadata.file_type).toBe('epub')
  })

  it('falls back to filename when OPF has no dc:title', async () => {
    const buf = await buildMinimalEpub({ title: '', author: '' })
    const { metadata } = await extractEpubInfo('/books/my-book.epub', buf)
    expect(metadata.title).toBe('my book') // filename → title
  })

  it('extracts cover via EPUB3 cover-image property', async () => {
    const buf = await buildMinimalEpub({ coverData: fakeJpeg, coverStrategy: 'epub3' })
    const { cover } = await extractEpubInfo('/books/test.epub', buf)
    expect(cover).not.toBeNull()
    expect(cover?.mimeType).toBe('image/jpeg')
  })

  it('extracts cover via EPUB2 meta name="cover"', async () => {
    const buf = await buildMinimalEpub({ coverData: fakeJpeg, coverStrategy: 'epub2' })
    const { cover } = await extractEpubInfo('/books/test.epub', buf)
    expect(cover).not.toBeNull()
    expect(cover?.mimeType).toBe('image/jpeg')
  })

  it('returns null cover for EPUB with no images', async () => {
    const buf = await buildMinimalEpub({ coverStrategy: 'none' })
    const { cover } = await extractEpubInfo('/books/test.epub', buf)
    expect(cover).toBeNull()
  })

  it('returns fallback metadata for an empty buffer without throwing', async () => {
    const { metadata, cover } = await extractEpubInfo('/books/broken.epub', Buffer.from([]))
    expect(metadata.title).toBe('broken')
    expect(cover).toBeNull()
  })
})
