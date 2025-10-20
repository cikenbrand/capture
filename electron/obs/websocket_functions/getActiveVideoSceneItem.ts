import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'
import './setActiveVideoSceneItem' // ensure IPC registered
import './getActiveCaptureDeviceInput' // ensure IPC registered
import './setCaptureDeviceInput' // ensure IPC registered

export type SourceActiveState = {
  videoCaptureDevice: boolean
  rtmp: boolean
  webrtc: boolean
}

export type ActiveVideoSceneItems = {
  [sourceIndex: number]: SourceActiveState
}

function createDefaultState(): ActiveVideoSceneItems {
  const out: ActiveVideoSceneItems = {}
  for (let i = 1; i <= 4; i++) {
    out[i] = { videoCaptureDevice: false, rtmp: false, webrtc: false }
  }
  return out
}

export async function getActiveVideoSceneItems(): Promise<ActiveVideoSceneItems> {
  const obs = getObsClient() as any
  if (!obs) return createDefaultState()

  const result = createDefaultState()

  // Flat scene layout: read enabled states directly from the current scene root
  try {
    const currentScene = await obs.call('GetCurrentProgramScene')
    const sceneName = String(currentScene?.currentProgramSceneName ?? currentScene?.sceneName ?? '')
    if (sceneName) {
      const list = await obs.call('GetSceneItemList', { sceneName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []

      const enabledOf = async (sceneItem: any): Promise<boolean | null> => {
        if (typeof sceneItem?.sceneItemEnabled === 'boolean') return !!sceneItem.sceneItemEnabled
        try {
          const en = await obs.call('GetSceneItemEnabled', { sceneName, sceneItemId: Number(sceneItem?.sceneItemId) })
          return !!en?.sceneItemEnabled
        } catch {
          return null
        }
      }

      for (const index of [1, 2, 3, 4]) {
        const idx = String(index)
        const setIf = async (label: 'videoCaptureDevice' | 'rtmp' | 'webrtc', prefix: string) => {
          const entry = items.find((it: any) => String(it?.sourceName ?? '').toLowerCase().startsWith(prefix) && String(it?.sourceName ?? '').toLowerCase().includes(idx))
          if (!entry) return
          const on = await enabledOf(entry)
          if (on != null) result[index][label] = on
        }
        await setIf('videoCaptureDevice', 'video capture device')
        await setIf('rtmp', 'rtmp')
        await setIf('webrtc', 'webrtc')
      }
    }
  } catch {}

  return result
}

// New: Return only sceneItemId and sourceName for each group (source 1..4) within a scene
// Removed group helpers since groups are no longer used

// Return enabled states for each expected input inside each group in a scene
export async function getActiveInputsForScene(sceneName: string): Promise<ActiveVideoSceneItems> {
  const obs = getObsClient() as any
  const result = createDefaultState()
  if (!obs) return result

  // Helper to read enabled state for an item inside a container (scene/group)
  const enabledOf = async (containerName: string, it: any): Promise<boolean> => {
    if (typeof it?.sceneItemEnabled === 'boolean') return !!it.sceneItemEnabled
    try {
      const en = await obs.call('GetSceneItemEnabled', { sceneName: containerName, sceneItemId: Number(it?.sceneItemId) })
      return !!en?.sceneItemEnabled
    } catch { return false }
  }

  try {
    const list = await obs.call('GetSceneItemList', { sceneName })
    const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []
    for (const it of items) {
      const name = String(it?.sourceName ?? '').toLowerCase()
      if (!name) continue
      const on = await enabledOf(sceneName, it)
      if (!on) continue
      for (let index = 1; index <= 4; index++) {
        const idxStr = String(index)
        if (name.startsWith('video capture device') && name.includes(idxStr)) result[index].videoCaptureDevice = true
        else if (name.startsWith('rtmp') && name.includes(idxStr)) result[index].rtmp = true
        else if (name.startsWith('webrtc') && name.includes(idxStr)) result[index].webrtc = true
      }
    }
  } catch {
    // ignore errors and return defaults
  }

  return result
}

// IPC: expose to renderer
ipcMain.handle('obs:get-active-video-items', async () => {
  try {
    const data = await getActiveVideoSceneItems()
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('obs:get-active-video-items-for-scene', async (_e, sceneName: string) => {
  try {
    const data = await getActiveInputsForScene(sceneName)
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


