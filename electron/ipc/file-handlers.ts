import { dialog, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { extractEpubInfo, extractPdfMetadata } from './metadata-extractor'
import type { ImportBookResult } from '../../shared/types'

export const IPC_OPEN_FILE_DIALOG = 'open-file-dialog'
export const IPC_READ_FILE = 'read-file'
export const IPC_IMPORT_BOOK = 'import-book'

// Prevents a stalled metadata extraction from hanging the IPC channel forever.
// 30 s is generous — extractEpubInfo typically completes in < 1 s.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Import timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_OPEN_FILE_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import a Book',
      buttonLabel: 'Import',
      filters: [
        { name: 'Books', extensions: ['pdf', 'epub'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'EPUB', extensions: ['epub'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IPC_READ_FILE, async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('readFile: filePath must be a string')
    const resolved = path.resolve(filePath)
    if (!fs.existsSync(resolved)) throw new Error(`readFile: file not found at ${resolved}`)
    return fs.readFileSync(resolved)
  })

  ipcMain.handle(IPC_IMPORT_BOOK, async (_event, filePath: unknown): Promise<ImportBookResult> => {
    if (typeof filePath !== 'string') throw new Error('importBook: filePath must be a string')

    const resolved = path.resolve(filePath)
    if (!fs.existsSync(resolved)) throw new Error(`importBook: file not found at ${resolved}`)

    const buffer = fs.readFileSync(resolved)
    const isEpub = path.extname(resolved).toLowerCase() === '.epub'

    if (isEpub) {
      const { metadata, cover } = await withTimeout(extractEpubInfo(resolved, buffer), 30_000)
      return {
        metadata,
        fileBuffer: new Uint8Array(buffer),
        coverBuffer: cover ? new Uint8Array(cover.data) : null,
        coverMimeType: cover?.mimeType ?? null,
      }
    }

    // PDF: synchronous scan — no Promise, no chance of hanging
    const metadata = extractPdfMetadata(resolved, buffer)
    return {
      metadata,
      fileBuffer: new Uint8Array(buffer),
      coverBuffer: null,
      coverMimeType: null,
    }
  })
}
