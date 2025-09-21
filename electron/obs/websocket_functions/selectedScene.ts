import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'
import { BrowserWindow } from 'electron'

/**
 * Returns the current Program scene name from OBS via obs-websocket-js.
 * If not connected or an error occurs, returns an empty string.
 */
export async function getCurrentSceneName(): Promise<string> {
  try {
    const obs = getObsClient() as any
    if (!obs) return ''

    const res = await obs.call('GetCurrentProgramScene')
    const name = (res as any)?.currentProgramSceneName ?? ''
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

ipcMain.handle('obs:get-current-scene', async () => {
  try {
    const name = await getCurrentSceneName()
    return name
  } catch {
    return ''
  }
})

// Broadcast OBS Program scene changes to all renderer windows
try {
  const obs = getObsClient() as any
  if (obs && typeof obs.on === 'function') {
    obs.on('CurrentProgramSceneChanged', (data: any) => {
      const name = (data as any)?.sceneName ?? ''
      const sceneName = typeof name === 'string' ? name : ''
      try {
        for (const bw of BrowserWindow.getAllWindows()) {
          try { bw.webContents.send('obs:current-scene-changed', sceneName) } catch {}
        }
      } catch {}
    })
  }
} catch {}


