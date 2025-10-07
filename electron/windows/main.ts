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
    title: 'Deepstrim Capture',
    frame: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'dc.ico'),
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
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'dc.ico'),
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

export function createExportProjectWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: true,
    frame: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'dc.ico'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, '..', '..'), 'dist-electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  })

  const devUrl = getDevUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=export-project`)
  } else {
    win.loadFile(path.join(getRendererDist(), 'index.html'), { query: { window: 'export-project' } as any })
  }
  return win
}

export function createPictureInPictureWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 270,
    show: true,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'dc.ico'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, '..', '..'), 'dist-electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  })

  try {
    // Enforce 16:9 aspect ratio regardless of user resize
    win.setAspectRatio(16 / 9)
    win.setMinimumSize(320, 180)
    win.setAlwaysOnTop(true, 'screen-saver')
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true } as any) } catch {}
  } catch {}

  const devUrl = getDevUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=picture-in-picture`)
  } else {
    win.loadFile(path.join(getRendererDist(), 'index.html'), { query: { window: 'picture-in-picture' } as any })
  }

  return win
}

export function createEventingWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: true,
    frame: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), 'dc.ico'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, '..', '..'), 'dist-electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  })

  const devUrl = getDevUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=eventing`)
  } else {
    win.loadFile(path.join(getRendererDist(), 'index.html'), { query: { window: 'eventing' } as any })
  }

  return win
}