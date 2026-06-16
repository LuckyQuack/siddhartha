import { contextBridge, ipcRenderer } from 'electron'
import { IPC_OPEN_FILE_DIALOG, IPC_READ_FILE, IPC_IMPORT_BOOK } from './ipc/file-handlers'
import type { ElectronAPI, DbAPI } from '../shared/types'

// The preload script runs in a privileged context with access to Node APIs
// but within the renderer process. contextBridge.exposeInMainWorld is the
// only safe way to pass capabilities to the renderer — it prevents the
// renderer from accessing the full ipcRenderer object and arbitrary Node APIs.

const electronAPI: ElectronAPI = {
  openFileDialog: () => ipcRenderer.invoke(IPC_OPEN_FILE_DIALOG),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_READ_FILE, filePath),
  importBook: (filePath: string) => ipcRenderer.invoke(IPC_IMPORT_BOOK, filePath),
  onMenuEvent: (event: string, callback: () => void) => {
    ipcRenderer.on(`menu:${event}`, () => callback())
  },
}

const dbAPI: DbAPI = {
  books: {
    list: (userId) => ipcRenderer.invoke('db:books:list', userId),
    create: (input) => ipcRenderer.invoke('db:books:create', input),
    get: (id, userId) => ipcRenderer.invoke('db:books:get', id, userId),
    update: (id, userId, patch) => ipcRenderer.invoke('db:books:update', id, userId, patch),
    delete: (id, userId) => ipcRenderer.invoke('db:books:delete', id, userId),
    touch: (id, userId) => ipcRenderer.invoke('db:books:touch', id, userId),
    saveCover: (bookId, data, mimeType) =>
      ipcRenderer.invoke('db:books:save-cover', bookId, data, mimeType),
  },
  highlights: {
    create: (input) => ipcRenderer.invoke('db:highlights:create', input),
    listByBook: (bookId, userId) =>
      ipcRenderer.invoke('db:highlights:list-by-book', bookId, userId),
  },
  sessions: {
    start: (input) => ipcRenderer.invoke('db:sessions:start', input),
    end: (id, pagesRead) => ipcRenderer.invoke('db:sessions:end', id, pagesRead),
  },
  user: {
    getOrCreateId: () => ipcRenderer.invoke('db:user:get-or-create-id'),
  },
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', dbAPI)
