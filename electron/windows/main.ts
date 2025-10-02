// windows/mainWindow.ts
import { BrowserWindow } from 'electron'
import path from 'node:path'

// Hard-coded (no external props): resolve dev/prod entrypoints here, safely at runtime
function getRendererDist() {
  return process.env.APP_ROOT
    ? path.join(process.env.APP_ROOT, 'dist')
    : path.join(__dirname, '..', '..', 'dist')
}

function getDevUrl() {
  return process.env['VITE_DEV_SERVER_URL'] || ''
}

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, '..', '..'), 'dist-electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devUrl = getDevUrl()
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(getRendererDist(), 'index.html'))
  }

  return win
}

export function createOverlayEditorWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true,
    frame: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, '..', '..'), 'dist-electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  })

  const devUrl = getDevUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=overlay-editor`)
  } else {
    win.loadFile(path.join(getRendererDist(), 'index.html'), { query: { window: 'overlay-editor' } as any })
  }

  return win
}