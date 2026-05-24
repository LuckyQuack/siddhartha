import { contextBridge, ipcRenderer } from 'electron'
import { IPC_OPEN_FILE_DIALOG, IPC_READ_FILE, IPC_IMPORT_BOOK } from './ipc/file-handlers'
import type { ElectronAPI } from '../shared/types'

// The preload script runs in a privileged context with access to Node APIs
// but within the renderer process. contextBridge.exposeInMainWorld is the
// only safe way to pass capabilities to the renderer — it prevents the
// renderer from accessing the full ipcRenderer object and arbitrary Node APIs.

const electronAPI: ElectronAPI = {
  openFileDialog: () => ipcRenderer.invoke(IPC_OPEN_FILE_DIALOG),

  readFile: (filePath: string) => ipcRenderer.invoke(IPC_READ_FILE, filePath),

  importBook: (filePath: string) => ipcRenderer.invoke(IPC_IMPORT_BOOK, filePath),

  // Forward application-menu events (e.g. "File > Import") to renderer
  // listeners without exposing the full event emitter API.
  onMenuEvent: (event: string, callback: () => void) => {
    ipcRenderer.on(`menu:${event}`, () => callback())
  },
}

contextBridge.exposeInMainWorld('electron', electronAPI)
