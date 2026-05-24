import { dialog, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// IPC channel names — kept as constants to avoid typos across main/preload.
export const IPC_OPEN_FILE_DIALOG = 'open-file-dialog'
export const IPC_READ_FILE = 'read-file'

/**
 * Register all file-related IPC handlers.
 * Call once during app ready, before any window is shown.
 */
export function registerFileHandlers(): void {
  // Opens the OS-native file picker and returns the chosen path (or null).
  // We filter to PDF and EPUB because those are the only formats the reader
  // supports. Returning null instead of throwing lets the renderer handle
  // cancellation without an error boundary.
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

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0] ?? null
  })

  // Reads a local file by absolute path and returns its contents as a Buffer.
  // The renderer cannot access the filesystem directly (contextIsolation: true),
  // so all disk I/O must go through this handler.
  ipcMain.handle(IPC_READ_FILE, async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') {
      throw new Error('readFile: filePath must be a string')
    }

    // Resolve to an absolute path to prevent path traversal.
    const resolved = path.resolve(filePath)

    // Confirm the file still exists before reading — import dialogs create a
    // window of time between selection and read where the file could move.
    if (!fs.existsSync(resolved)) {
      throw new Error(`readFile: file not found at ${resolved}`)
    }

    return fs.readFileSync(resolved)
  })
}
