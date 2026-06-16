// DOM-native EPUB parser. Runs in the renderer (browser context).
// Uses JSZip (already a transitive dep via epubjs) to unpack the archive,
// resolves the spine order, rewrites image srcs to blob: URLs, and returns
// each chapter as a cleaned HTML string safe for dangerouslySetInnerHTML.

interface ZipObject {
  async(type: 'text'): Promise<string>
  async(type: 'arraybuffer'): Promise<ArrayBuffer>
  dir: boolean
}
interface ZipInstance {
  file(name: string): ZipObject | null
  files: Record<string, ZipObject>
}
interface JSZipStatic {
  loadAsync(data: ArrayBuffer): Promise<ZipInstance>
}

export interface EpubChapter {
  id: string
  title: string
  html: string
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml',
}

function resolveZipPath(href: string, base: string): string {
  const decoded = decodeURIComponent(href.split('#')[0] ?? href)
  if (decoded.startsWith('/')) return decoded.slice(1)
  const parts = (base + decoded).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p && p !== '.') out.push(p)
  }
  return out.join('/')
}

function zipFile(zip: ZipInstance, name: string): ZipObject | null {
  const exact = zip.file(name)
  if (exact) return exact
  const lower = name.toLowerCase()
  const key = Object.keys(zip.files).find(k => k.toLowerCase() === lower)
  return key ? (zip.files[key] ?? null) : null
}

function extractBody(html: string): string {
  // Pull content between <body...> and </body>; fall back to full string.
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  return m ? (m[1] ?? html) : html
}

function stripTags(html: string, ...tags: string[]): string {
  for (const tag of tags) {
    html = html.replace(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi'), '')
    html = html.replace(new RegExp(`<${tag}(\\s[^>]*)?\\/?>`, 'gi'), '')
  }
  return html
}

async function rewriteImages(
  html: string,
  chapterDir: string,
  zip: ZipInstance,
  blobUrls: string[]
): Promise<string> {
  // Collect unique hrefs that look like local resources
  const found = new Map<string, string>() // href → blob URL
  const attrRegex = /(?:src|href|xlink:href)="([^"]+)"/g
  let m: RegExpExecArray | null

  const toLoad: string[] = []
  const seen = new Set<string>()
  const clone = new RegExp(attrRegex.source, 'g')
  while ((m = clone.exec(html)) !== null) {
    const raw = m[1] ?? ''
    if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('#')) continue
    const href = raw.split('#')[0] ?? raw
    if (!seen.has(href)) { seen.add(href); toLoad.push(href) }
  }

  for (const href of toLoad) {
    const zipPath = resolveZipPath(href, chapterDir)
    const file = zipFile(zip, zipPath)
    if (!file || file.dir) continue
    const ext = zipPath.split('.').pop()?.toLowerCase() ?? ''
    const mime = IMAGE_MIME[ext]
    if (!mime) continue // only rewrite images
    try {
      const buf = await file.async('arraybuffer')
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
      blobUrls.push(blobUrl)
      found.set(href, blobUrl)
    } catch { /* skip missing */ }
  }

  let result = html
  for (const [href, blobUrl] of found) {
    // Replace href in attribute values only (avoid replacing text content)
    result = result.replaceAll(`"${href}"`, `"${blobUrl}"`)
  }
  return result
}

export async function parseEpub(url: string, blobUrls: string[]): Promise<EpubChapter[]> {
  const { default: JSZip } = await import('jszip') as unknown as { default: JSZipStatic }
  const data = await fetch(url).then(r => r.arrayBuffer())
  const zip = await JSZip.loadAsync(data)

  // ── Container → OPF path ─────────────────────────────────────────────────
  const containerXml = await zipFile(zip, 'META-INF/container.xml')?.async('text')
  if (!containerXml) throw new Error('Not a valid EPUB: missing container.xml')
  const opfPath = /full-path="([^"]+)"/.exec(containerXml)?.[1]
  if (!opfPath) throw new Error('Not a valid EPUB: could not locate OPF')

  const opfXml = await zipFile(zip, opfPath)?.async('text')
  if (!opfXml) throw new Error('Not a valid EPUB: could not read OPF')

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  // ── Manifest ──────────────────────────────────────────────────────────────
  const manifest = new Map<string, { href: string; mediaType: string }>()
  for (const m of opfXml.matchAll(/<item\b([^>]*)\/?>/g)) {
    const tag = m[0]
    const id       = /\bid="([^"]+)"/.exec(tag)?.[1]
    const href     = /\bhref="([^"]+)"/.exec(tag)?.[1]
    const mediaType = /\bmedia-type="([^"]+)"/.exec(tag)?.[1] ?? ''
    if (id && href) manifest.set(id, { href: decodeURIComponent(href), mediaType })
  }

  // ── Spine ─────────────────────────────────────────────────────────────────
  const spineSection = /<spine\b[^>]*>([\s\S]*?)<\/spine>/i.exec(opfXml)?.[1] ?? ''
  const idrefs: string[] = []
  for (const m of spineSection.matchAll(/idref="([^"]+)"/g)) {
    if (m[1]) idrefs.push(m[1])
  }

  // ── Chapters ──────────────────────────────────────────────────────────────
  const chapters: EpubChapter[] = []

  for (const idref of idrefs) {
    const item = manifest.get(idref)
    if (!item) continue
    if (!item.mediaType.includes('html') && !item.mediaType.includes('xhtml')) continue

    const zipPath = resolveZipPath(item.href, opfDir)
    const chapterDir = zipPath.includes('/') ? zipPath.slice(0, zipPath.lastIndexOf('/') + 1) : ''
    const file = zipFile(zip, zipPath)
    if (!file) continue

    let html = await file.async('text')

    // Strip unsafe/style tags; keep structural content only
    html = stripTags(html, 'script', 'style', 'link')
    html = extractBody(html)
    html = await rewriteImages(html, chapterDir, zip, blobUrls)

    const title = /\.([^./]+)$/.exec(item.href)?.[0] === item.href
      ? item.href
      : item.href.replace(/\.[^.]+$/, '').split('/').pop() ?? idref

    chapters.push({ id: idref, title, html })
  }

  if (chapters.length === 0) throw new Error('EPUB has no readable chapters')
  return chapters
}
