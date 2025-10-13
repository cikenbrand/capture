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

/**
 * Returns which items are currently enabled for groups "source 1".."source 4".
 * Each group is expected to contain inputs named: "video capture device X", "rtmp X", "webrtc X".
 */
export async function getActiveVideoSceneItems(): Promise<ActiveVideoSceneItems> {
  const obs = getObsClient() as any
  if (!obs) return createDefaultState()

  const result = createDefaultState()

  for (let index = 1; index <= 4; index++) {
    const groupName = `source ${index}`
    try {
      const list = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []

      // Helper to resolve enabled state for an item by rough name match
      const setStateFor = async (label: 'videoCaptureDevice' | 'rtmp' | 'webrtc', match: (name: string) => boolean) => {
        const entry = items.find((it: any) => match(String(it?.sourceName ?? '')))
        if (!entry) return
        let enabled: boolean | null = null
        // Prefer embedded state if present on list response
        if (typeof entry?.sceneItemEnabled === 'boolean') {
          enabled = !!entry.sceneItemEnabled
        } else {
          try {
            const enabledRes = await obs.call('GetSceneItemEnabled', { sceneName: groupName, sceneItemId: Number(entry.sceneItemId) })
            enabled = !!enabledRes?.sceneItemEnabled
          } catch {
            enabled = null
          }
        }
        if (enabled != null) {
          result[index][label] = enabled
        }
      }

      const lcIndex = String(index).toLowerCase()
      await setStateFor('videoCaptureDevice', (name) => name.toLowerCase().startsWith('video capture device') && name.toLowerCase().includes(lcIndex))
      await setStateFor('rtmp', (name) => name.toLowerCase().startsWith('rtmp') && name.toLowerCase().includes(lcIndex))
      await setStateFor('webrtc', (name) => name.toLowerCase().startsWith('webrtc') && name.toLowerCase().includes(lcIndex))
    } catch {
      // keep defaults for this group on error
    }
  }

  return result
}

// New: Return only sceneItemId and sourceName for each group (source 1..4) within a scene
export type GroupSceneItems = { [sourceIndex: number]: Array<{ id: number; name: string }> }

export async function getGroupSceneItemListForScene(sceneName: string): Promise<GroupSceneItems> {
  const obs = getObsClient() as any
  const result: GroupSceneItems = { 1: [], 2: [], 3: [], 4: [] }
  if (!obs) return result

  try {
    const sceneRes = await obs.call('GetSceneItemList', { sceneName })
    const sceneItems: any[] = Array.isArray(sceneRes?.sceneItems) ? sceneRes.sceneItems : []

    // Map actual group names present in the scene to their numeric index by pattern "source <n>"
    const indexToGroupName: Record<number, string> = {}
    for (const it of sceneItems) {
      const name = String(it?.sourceName ?? '')
      const m = /^source\s*(\d+)$/i.exec(name.trim())
      if (m) {
        const idx = Number(m[1])
        if (idx >= 1 && idx <= 4) indexToGroupName[idx] = name
      }
    }

    // Fallback: also inspect global group list (some OBS setups expose groups only here)
    try {
      const groups = await obs.call('GetGroupList')
      const names: string[] = Array.isArray(groups?.groups) ? groups.groups : []
      for (const g of names) {
        const m = /^source\s*(\d+)$/i.exec(String(g).trim())
        if (m) {
          const idx = Number(m[1])
          if (idx >= 1 && idx <= 4 && !indexToGroupName[idx]) indexToGroupName[idx] = String(g)
        }
      }
    } catch {}

    for (let index = 1; index <= 4; index++) {
      const groupName = indexToGroupName[index] || `source ${index}`
      try {
        const list = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
        const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []
        result[index] = items.map((it: any) => ({ id: Number(it?.sceneItemId), name: String(it?.sourceName ?? '') }))
      } catch {
        // leave empty if group not found
      }
    }
  } catch {}

  return result
}

// Return enabled states for each expected input inside each group in a scene
export async function getActiveInputsForScene(sceneName: string): Promise<ActiveVideoSceneItems> {
  const obs = getObsClient() as any
  const result = createDefaultState()
  if (!obs) return result

  // Resolve actual group names present
  const groups = await getGroupSceneItemListForScene(sceneName)

  for (let index = 1; index <= 4; index++) {
    const groupName = `source ${index}`
    try {
      const list = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []

      const enabledOf = async (sceneItem: any): Promise<boolean> => {
        if (typeof sceneItem?.sceneItemEnabled === 'boolean') return !!sceneItem.sceneItemEnabled
        try {
          const en = await obs.call('GetSceneItemEnabled', { sceneName: groupName, sceneItemId: Number(sceneItem?.sceneItemId) })
          return !!en?.sceneItemEnabled
        } catch { return false }
      }

      for (const it of items) {
        const name = String(it?.sourceName ?? '').toLowerCase()
        if (!name) continue
        const on = await enabledOf(it)
        if (!on) continue
        if (name.startsWith('video capture device') && name.includes(String(index))) {
          result[index].videoCaptureDevice = true
        } else if (name.startsWith('rtmp') && name.includes(String(index))) {
          result[index].rtmp = true
        } else if (name.startsWith('webrtc') && name.includes(String(index))) {
          result[index].webrtc = true
        }
      }
    } catch {
      // ignore
    }
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


