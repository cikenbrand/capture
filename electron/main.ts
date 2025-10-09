import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSplashWindow } from './windows/splashscreen'
import { createMainWindow, createOverlayEditorWindow, createExportProjectWindow, createPictureInPictureWindow, createEventingWindow, createDataConfigurationsWindow } from './windows/main'
import { openObs } from './obs/openOBS'
import { exitOBS } from './obs/websocket_functions/exitOBS'
import { checkIfOBSOpenOrNot } from './obs/checkIfOBSOpenOrNot'
import { connectToOBSWebsocket } from './obs/websocket_functions/connectToOBSWebsocket'
import './obs/websocket_functions/selectedScene'
import './obs/websocket_functions/setSelectedScene'
import { startBrowserSourceService, stopBrowserSourceService } from './services/browserSourceService'
import { OVERLAY_WS_PORT } from './settings'
import { SPLASHSCREEN_DURATION_MS } from './settings'
import { autoUpdater } from 'electron-updater'
import './db/createProject'
import './db/createOverlay'
import './db/getAllOverlay'
import './db/createTask'
import './db/getAllTasks'
import './db/getSelectedTaskDetails'
import './db/editTask'
import './db/createDive'
import './db/createSession'
import './db/editDive'
import './db/createNode'
import './db/editNode'
import './db/getAllNodes'
import './db/deleteNode'
import './db/getSelectedNodeDetails'
import './db/getAllProjects'
import './getter-setter/selectedProject'
import './getter-setter/selectedDive'
import './getter-setter/diveState'
import './getter-setter/selectedTask'
import './getter-setter/selectedNode'
import './db/getAllDives'
import './db/getSelectedProjectDetails'
import './db/getSelectedDiveDetails'
import './db/editProject'
import './getter-setter/selectedDrawingTool'
import './getter-setter/selectedOverlayLayer'
import './getter-setter/selectedOverlayComponent'
import './getter-setter/activeSession'
import './db/renameOverlay'
import './db/deleteOverlay'
import './db/createOverlayComponent'
import './db/getAllOverlayComponents'
import './db/editOverlayComponent'
import './db/deleteOverlayComponent'
import './db/getOverlayComponentsForRender'
import './db/uploadOverlayImage'
import './db/addProjectLog'
import './db/getAllOverlayImages'
import './obs/websocket_functions/getLiveDevices'
import './obs/websocket_functions/getRecordingDirectory'
import './obs/websocket_functions/getFileNameFormatting'
import './obs/websocket_functions/getClipFileNameFormatting'
import './obs/websocket_functions/setFileNameFormatting'
import './obs/websocket_functions/setClipRecordingFileNameFormatting'
import './obs/websocket_functions/startClipRecording'
import './obs/websocket_functions/stopClipRecording'
import './getter-setter/recordingState'
import './obs/websocket_functions/startRecording'
import './obs/websocket_functions/stopRecording'
import './obs/websocket_functions/pauseRecording'
import './obs/websocket_functions/resumeRecording'
import './obs/websocket_functions/setClipRecordingFileNameFormatting'
import './obs/websocket_functions/startClipRecording'
import './obs/websocket_functions/stopClipRecording'
import './obs/websocket_functions/takeSnapshot'
import './db/getProjectLogs'
import './db/deleteOverlayImage'
import './db/exportOverlay'
import './getter-setter/serialDeviceState'
import { getCOMPorts } from './serial-data/getCOMPorts'
import './db/importOverlay'
import './db/exportOverlay'
import './db/createDataKey'
import './db/fetchDataKey'
import './db/addEventLog'
import './db/getEventLogs'
import './db/editEventLog'

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
let pipWin: BrowserWindow | null = null
let eventingWin: BrowserWindow | null = null
let dataConfigWin: BrowserWindow | null = null

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
      try {
        if (Date.now() - splashStart > 10000) {
          await dialog.showMessageBox({ type: 'error', title: 'Service Error', message: 'Failed to launch OBS. Please start OBS manually and retry.' })
        }
      } catch {}
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
  let drawingServiceOk = false
  try { drawingServiceOk = await startBrowserSourceService() } catch { drawingServiceOk = false }
  if (!drawingServiceOk) {
    try {
      if (Date.now() - splashStart > 10000) {
        await dialog.showMessageBox({ type: 'error', title: 'Service Error', message: `Failed to start drawing service on localhost (port ${OVERLAY_WS_PORT}). The app will continue retrying, but features depending on it may not work until the service starts.` })
      }
    } catch {}
  }
  let wsErrorShown = false
  while (true) {
    const ok = await connectToOBSWebsocket(4000)
    if (ok) break
    if (!wsErrorShown) {
      try {
        if (Date.now() - splashStart > 10000) {
          await dialog.showMessageBox({ type: 'error', title: 'OBS Connection Error', message: 'Failed to connect to OBS WebSocket. Retrying…\nPlease ensure OBS is running and WebSocket is enabled.' })
          wsErrorShown = true
        }
      } catch {}
    }
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

  // 5) Check for updates (GitHub) when online
  try {
    const online = await new Promise<boolean>((resolve) => {
      try {
        const req = require('node:https').request({ method: 'HEAD', host: 'api.github.com', path: '/', headers: { 'User-Agent': 'deepstrim-capture' }, timeout: 3000 }, (res: any) => { try { res.destroy() } catch {}; resolve(true) })
        req.on('error', () => resolve(false))
        req.on('timeout', () => { try { req.destroy() } catch {}; resolve(false) })
        req.end()
      } catch { resolve(false) }
    })
    if (online) {
      autoUpdater.autoDownload = false
      autoUpdater.on('update-available', async () => {
        try {
          const choice = await win?.webContents.executeJavaScript('new Promise(r=>{const ok=confirm("An update is available. Download and install now?"); r(ok)})')
          if (choice) autoUpdater.downloadUpdate()
        } catch {}
      })
      autoUpdater.on('update-downloaded', async () => {
        try {
          const choice = await win?.webContents.executeJavaScript('new Promise(r=>{const ok=confirm("Update downloaded. Install and restart now?"); r(ok)})')
          if (choice) autoUpdater.quitAndInstall()
        } catch {}
      })
      try { await autoUpdater.checkForUpdates() } catch {}
    }
  } catch {}

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
  try { await stopBrowserSourceService() } catch {}
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

let exportProjectWin: BrowserWindow | null = null
ipcMain.handle('window:open-export-project', async () => {
  try {
    if (exportProjectWin && !exportProjectWin.isDestroyed()) {
      exportProjectWin.show()
      exportProjectWin.focus()
      return true
    }
    exportProjectWin = createExportProjectWindow()
    exportProjectWin.on('closed', () => { exportProjectWin = null })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('export-window:minimize', async () => {
  try {
    exportProjectWin?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('export-window:toggle-maximize', async () => {
  try {
    if (!exportProjectWin || exportProjectWin.isDestroyed()) return false
    if (exportProjectWin.isMaximized()) {
      exportProjectWin.unmaximize()
    } else {
      exportProjectWin.maximize()
    }
    return true
  } catch {
    return false
  }
})

ipcMain.handle('export-window:close', async () => {
  try {
    exportProjectWin?.close()
    return true
  } catch {
    return false
  }
})
ipcMain.handle('window:open-pip', async () => {
  try {
    if (pipWin && !pipWin.isDestroyed()) {
      pipWin.show()
      pipWin.focus()
      return true
    }
    pipWin = createPictureInPictureWindow()
    pipWin.on('closed', () => { pipWin = null })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('window:open-eventing', async () => {
  try {
    if (eventingWin && !eventingWin.isDestroyed()) {
      eventingWin.show()
      eventingWin.focus()
      return true
    }
    eventingWin = createEventingWindow()
    eventingWin.on('closed', () => { eventingWin = null })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('eventing-window:minimize', async () => {
  try {
    eventingWin?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('eventing-window:toggle-maximize', async () => {
  try {
    if (!eventingWin || eventingWin.isDestroyed()) return false
    if (eventingWin.isMaximized()) {
      eventingWin.unmaximize()
    } else {
      eventingWin.maximize()
    }
    return true
  } catch {
    return false
  }
})

ipcMain.handle('eventing-window:close', async () => {
  try {
    eventingWin?.close()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('window:open-data-configurations', async () => {
  try {
    if (dataConfigWin && !dataConfigWin.isDestroyed()) {
      dataConfigWin.show()
      dataConfigWin.focus()
      return true
    }
    dataConfigWin = createDataConfigurationsWindow()
    dataConfigWin.on('closed', () => { dataConfigWin = null })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('data-config-window:minimize', async () => {
  try {
    dataConfigWin?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('data-config-window:toggle-maximize', async () => {
  try {
    if (!dataConfigWin || dataConfigWin.isDestroyed()) return false
    if (dataConfigWin.isMaximized()) {
      dataConfigWin.unmaximize()
    } else {
      dataConfigWin.maximize()
    }
    return true
  } catch {
    return false
  }
})

ipcMain.handle('data-config-window:close', async () => {
  try {
    dataConfigWin?.close()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('pip-window:minimize', async () => {
  try { pipWin?.minimize(); return true } catch { return false }
})
ipcMain.handle('pip-window:close', async () => {
  try { pipWin?.close(); return true } catch { return false }
})
ipcMain.handle('overlay-window:minimize', async () => {
  try {
    overlayEditorWin?.minimize()
    return true
  } catch {
    return false
  }
})

ipcMain.handle('overlay-window:toggle-maximize', async () => {
  try {
    if (!overlayEditorWin || overlayEditorWin.isDestroyed()) return false
    if (overlayEditorWin.isMaximized()) {
      overlayEditorWin.unmaximize()
    } else {
      overlayEditorWin.maximize()
    }
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

ipcMain.handle('window:toggle-maximize', async () => {
  try {
    if (!win || win.isDestroyed()) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
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

ipcMain.handle('serial:getCOMPorts', async () => {
  try {
    const ports = await getCOMPorts()
    return { ok: true, data: ports }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

// Generic folder picker dialog
ipcMain.handle('dialog:selectDirectory', async () => {
  try {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || !res.filePaths?.[0]) return { ok: false, error: 'cancelled' }
    return { ok: true, data: res.filePaths[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('dialog:openJsonFile', async () => {
  try {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (res.canceled || !res.filePaths?.[0]) return { ok: false, error: 'cancelled' }
    return { ok: true, data: res.filePaths[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})