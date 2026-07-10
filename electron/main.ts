import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import type { BrowserWindow } from 'electron'

const require = createRequire(import.meta.url)
const { app, BrowserWindow: BrowserWindowClass, protocol, net } = require('electron')

// Allocate maximum memory (4GB old space) to the V8 engine
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')

// Register the custom 'app' scheme as privileged before the app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true
    }
  }
])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// Let Vite configure the build path for electron
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindowClass({
    width: 1200,
    height: 800,
    title: 'SEO Log Analyzer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Needed for DuckDB-WASM and OPFS:
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // allow loading local assets easily
    },
  })

  // Test active push message to Renderer-process.
  win?.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win?.loadURL(VITE_DEV_SERVER_URL)
    win?.webContents.openDevTools()
  } else {
    win?.loadURL('app://-/index.html')
  }
}

app.whenReady().then(() => {
  // Handle requests for the custom 'app' protocol
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url)
      const pathname = url.pathname
      const decodedPath = decodeURIComponent(pathname)
      const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\))+/, '')
      const filePath = path.join(RENDERER_DIST, normalizedPath === '/' || normalizedPath === '\\' ? 'index.html' : normalizedPath)

      const fileUrl = pathToFileURL(filePath).toString()
      const response = await net.fetch(fileUrl)

      // Add security headers to enable SharedArrayBuffer and OPFS
      const headers = new Headers(response.headers)
      headers.set('Cross-Origin-Opener-Policy', 'same-origin')
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch (err) {
      console.error('Failed to serve custom protocol:', err)
      return new Response('Not Found', { status: 404 })
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindowClass.getAllWindows().length === 0) {
    createWindow()
  }
})
