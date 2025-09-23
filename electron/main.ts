import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSplashWindow } from './windows/splashscreen'
import { createMainWindow, createOverlayEditorWindow } from './windows/main'
import { openObs } from './obs/openOBS'
import { exitOBS } from './obs/websocket_functions/exitOBS'
import { checkIfOBSOpenOrNot } from './obs/checkIfOBSOpenOrNot'
import { connectToOBSWebsocket } from './obs/websocket_functions/connectToOBSWebsocket'
import './obs/websocket_functions/selectedScene'
import './obs/websocket_functions/setSelectedScene'
import { startDrawingService, stopDrawingService } from './services/drawingService'
import { OVERLAY_WS_PORT } from './settings'
import { SPLASHSCREEN_DURATION_MS } from './settings'
import './db/createProject'
import './db/createOverlay'
import './db/getAllOverlay'
import './db/createTask'
import './db/getAllTasks'
import './db/getSelectedTaskDetails'
import './db/editTask'
import './db/createDive'
import './db/editDive'
import './db/createNode'
import './db/editNode'
import './db/getAllNodes'
import './db/deleteNode'
import './db/getSelectedNodeDetails'
import './db/getAllProjects'
import './getter-setter/selectedProject'
import './getter-setter/selectedDive'
import './getter-setter/selectedTask'
import './getter-setter/selectedNode'
import './db/getAllDives'
import './db/getSelectedProjectDetails'
import './db/getSelectedDiveDetails'
import './db/editProject'
import './getter-setter/selectedDrawingTool'
import './getter-setter/selectedOverlayLayer'
import './getter-setter/selectedOverlayComponent'
import './db/renameOverlay'
import './db/deleteOverlay'
import './db/createOverlayComponent'
import './db/getAllOverlayComponents'
import './db/editOverlayComponent'
import './db/deleteOverlayComponent'
import './db/getOverlayComponentsForRender'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Vite dev/prod paths
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
let splashWin: BrowserWindow | null = null
let overlayEditorWin: BrowserWindow | null = null

// ——— helpers ———
function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}
function onceReadyToShow(bw: BrowserWindow) {
  return new Promise<void>(resolve => {
    if (bw.isDestroyed()) return resolve()
    if (bw.isVisible()) return resolve()
    bw.once('ready-to-show', () => resolve())
  })
}

async function createWindow() {
  splashWin = createSplashWindow(SPLASHSCREEN_DURATION_MS)
  const splashStart = Date.now()

  const updateSplash = async (text: string) => {
    try {
      if (splashWin && !splashWin.isDestroyed()) {
        await splashWin.webContents.executeJavaScript(
          `window.postMessage({ type: 'status', text: ${JSON.stringify(text)} }, '*')`
        )
      }
    } catch (_) {
      // ignore
    }
  }

  // 1) Check OBS process; launch if not running, then wait until it is
  await updateSplash('Checking OBS…')
  let isObsRunning = false
  try {
    isObsRunning = checkIfOBSOpenOrNot()
  } catch (_) {
    isObsRunning = false
  }

  let launchedObs = false
  if (!isObsRunning) {
    await updateSplash('Launching OBS…')
    try {
      openObs()
      launchedObs = true
    } catch (err) {
      console.error('Failed to launch OBS:', err)
    }
  }

  // Wait until OBS is confirmed open only if we launched it
  if (launchedObs) {
    await updateSplash('Waiting for OBS to start…')
    while (true) {
      try {
        if (checkIfOBSOpenOrNot()) break
      } catch (_) {
        // keep waiting
      }
      await delay(1000)
    }
  }

  // 2) Connect to OBS WebSocket, keep retrying while on splash
  await updateSplash('Connecting to OBS WebSocket…')
  // Also start drawing service early
  try { await startDrawingService() } catch {}
  while (true) {
    const ok = await connectToOBSWebsocket(4000)
    if (ok) break
    await updateSplash('Failed to connect. Retrying…')
    await delay(1500)
  }

  // 3) Create main window only after successful connection
  win = createMainWindow()

  await onceReadyToShow(win)
  const elapsed = Date.now() - splashStart
  const remaining = Math.max(0, SPLASHSCREEN_DURATION_MS - elapsed)
  if (remaining > 0) await delay(remaining)

  // 4) Close splash, show main
  if (splashWin && !splashWin.isDestroyed()) splashWin.close()
  splashWin = null
  win?.show()

  // Optional: crash/unresponsive guards
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer crashed:', details)
  })
  win.on('unresponsive', () => {
    console.warn('Window unresponsive')
  })
}

// Mac lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})
// Ensure OBS is asked to shutdown cleanly before app quits
let isQuitting = false
app.on('before-quit', async (e) => {
  if (isQuitting) return
  e.preventDefault()
  isQuitting = true
  try {
    await exitOBS()
  } catch {}
  try { await stopDrawingService() } catch {}
  app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// IPC: window controls
ipcMain.on('overlay:get-port-sync', (e) => {
  try { e.returnValue = OVERLAY_WS_PORT } catch { e.returnValue = 3620 }
})
ipcMain.handle('window:open-overlay-editor', async () => {
  try {
    if (overlayEditorWin && !overlayEditorWin.isDestroyed()) {
      overlayEditorWin.show()
      overlayEditorWin.focus()
      return true
    }
    overlayEditorWin = createOverlayEditorWindow()
    overlayEditorWin.on('closed', () => { overlayEditorWin = null })
    return true
  } catch {
    return false
  }
})
ipcMain.handle('overlay-window:minimize', async () => {
  try {
    overlayEditorWin?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('overlay-window:close', async () => {
  try {
    overlayEditorWin?.close()
    return true
  } catch {
    return false
  }
})
ipcMain.handle('window:minimize', async () => {
  try {
    win?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('window:close', async () => {
  try {
    win?.close()
    return true
  } catch {
    return false
  }
})