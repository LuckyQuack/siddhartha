import { app, BrowserWindow, Menu } from 'electron'
import * as path from 'path'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerDbHandlers } from './ipc/db-handlers'

const isDev = process.env.NODE_ENV === 'development'

// Keep a module-level reference so the window isn't garbage-collected when
// JavaScript GC runs while the event loop is idle.
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Siddhartha',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      // Preload runs in a privileged context before the renderer.
      preload: path.join(__dirname, 'preload.js'),
      // Isolate the renderer world from the preload — only the API we expose
      // via contextBridge is accessible, nothing else.
      contextIsolation: true,
      // Node.js APIs must not run in the renderer. All system access goes
      // through the preload bridge.
      nodeIntegration: false,
      // sandbox: false is required so the preload can use Node's require().
      // This is safe because contextIsolation is still on.
      sandbox: false,
    },
    // Remove the default menu bar; we'll add our own minimal app menu below.
    autoHideMenuBar: false,
    show: false,
  })

  // Don't show until content is ready — avoids a white flash on startup.
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    // Point to the Next.js dev server started by concurrently.
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // In production, Next.js is built to a static export in renderer/out/.
    mainWindow.loadFile(path.join(__dirname, '../renderer/out/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Siddhartha',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Book…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // Forward to the renderer so it can update state after import.
            mainWindow?.webContents.send('menu:import-book')
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Register IPC handlers before creating the window so they are available
  // for any invoke calls the renderer makes during its initial render.
  registerFileHandlers()
  registerDbHandlers()
  buildAppMenu()
  createWindow()

  // macOS re-creates the window when the dock icon is clicked and no windows
  // are open, which is standard macOS app behaviour.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS where apps stay running
// in the dock until the user explicitly quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
