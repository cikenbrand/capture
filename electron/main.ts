import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSplashWindow } from './windows/splashscreen'
import { createMainWindow } from './windows/main'
import { openObs } from './obs/openOBS'
import { exitOBS } from './obs/websocket_functions/exitOBS'
import { checkIfOBSOpenOrNot } from './obs/checkIfOBSOpenOrNot'
import { connectToOBSWebsocket } from './obs/websocket_functions/connectToOBSWebsocket'
import { getCurrentSceneName } from './obs/websocket_functions/selectedScene'
import { SPLASHSCREEN_DURATION_MS } from './settings'
import { startRecording } from './obs/websocket_functions/startRecording'
import { stopRecording } from './obs/websocket_functions/stopRecording'
import { getRecordingDirectory } from './obs/websocket_functions/getRecordingDirectory'
import { setRecordingDirectory } from './obs/websocket_functions/setRecordingDirectory'
import { getFileNameFormatting } from './obs/websocket_functions/getFileNameFormatting'

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
  app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// IPC: provide current scene to renderer
ipcMain.handle('obs:get-current-scene', async () => {
  try {
    const name = await getCurrentSceneName()
    return name
  } catch {
    return ''
  }
})

// IPC: start/stop recording
ipcMain.handle('obs:start-recording', async (_e, args: { preview: boolean, ch1: boolean, ch2: boolean, ch3: boolean, ch4: boolean }) => {
  try {
    const { preview, ch1, ch2, ch3, ch4 } = args || ({} as any)
    const ok = await startRecording(!!preview, !!ch1, !!ch2, !!ch3, !!ch4)
    return ok
  } catch {
    return false
  }
})

ipcMain.handle('obs:stop-recording', async () => {
  try {
    const ok = await stopRecording()
    return ok
  } catch {
    return false
  }
})

// IPC: get recording directory from basic.ini
ipcMain.handle('obs:get-recording-directory', async () => {
  try {
    const dir = await getRecordingDirectory()
    return dir
  } catch {
    return ''
  }
})

// IPC: set recording directory in basic.ini
ipcMain.handle('obs:set-recording-directory', async (_e, targetPath: string) => {
  try {
    const ok = await setRecordingDirectory(targetPath)
    return ok
  } catch {
    return false
  }
})

// IPC: get filename formatting from profile parameter
ipcMain.handle('obs:get-file-name-formatting', async () => {
  try {
    const value = await getFileNameFormatting()
    return value
  } catch {
    return ''
  }
})
