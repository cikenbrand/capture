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

  // Helper: read enabled states from a given container (scene or group)
  const resolveStatesFromContainer = async (containerName: string, listGetter: 'GetSceneItemList' | 'GetGroupSceneItemList') => {
    try {
      const list = await obs.call(listGetter, { sceneName: containerName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []

      const enabledOf = async (sceneItem: any): Promise<boolean | null> => {
        if (typeof sceneItem?.sceneItemEnabled === 'boolean') return !!sceneItem.sceneItemEnabled
        try {
          const en = await obs.call('GetSceneItemEnabled', { sceneName: containerName, sceneItemId: Number(sceneItem?.sceneItemId) })
          return !!en?.sceneItemEnabled
        } catch {
          return null
        }
      }

      for (const index of [1, 2, 3, 4]) {
        const lcIndex = String(index)
        const matchAndSet = async (label: 'videoCaptureDevice' | 'rtmp' | 'webrtc', prefix: string) => {
          const entry = items.find((it: any) => String(it?.sourceName ?? '').toLowerCase().startsWith(prefix) && String(it?.sourceName ?? '').toLowerCase().includes(lcIndex))
          if (!entry) return
          const on = await enabledOf(entry)
          if (on != null) result[index][label] = on
        }
        await matchAndSet('videoCaptureDevice', 'video capture device')
        await matchAndSet('rtmp', 'rtmp')
        await matchAndSet('webrtc', 'webrtc')
      }
    } catch {
      // ignore container fetch errors
    }
  }

  // First try: if groups like "source 1".."source 4" exist, read states from groups
  let hasAtLeastOneGroup = false
  try {
    const groups = await obs.call('GetGroupList')
    const names: string[] = Array.isArray(groups?.groups) ? groups.groups : []
    for (let index = 1; index <= 4; index++) {
      const groupName = names.find((n) => String(n).toLowerCase() === `source ${index}`)
      if (groupName) {
        hasAtLeastOneGroup = true
        await resolveStatesFromContainer(String(groupName), 'GetGroupSceneItemList')
      }
    }
  } catch {}

  // Fallback: flat scene layout like in the screenshot
  if (!hasAtLeastOneGroup) {
    try {
      const currentScene = await obs.call('GetCurrentProgramScene')
      const sceneName = String(currentScene?.currentProgramSceneName ?? currentScene?.sceneName ?? '')
      if (sceneName) {
        await resolveStatesFromContainer(sceneName, 'GetSceneItemList')
      }
    } catch {
      // ignore
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

  // Helper to read enabled state for an item inside a container (scene/group)
  const enabledOf = async (containerName: string, it: any): Promise<boolean> => {
    if (typeof it?.sceneItemEnabled === 'boolean') return !!it.sceneItemEnabled
    try {
      const en = await obs.call('GetSceneItemEnabled', { sceneName: containerName, sceneItemId: Number(it?.sceneItemId) })
      return !!en?.sceneItemEnabled
    } catch { return false }
  }

  try {
    const top = await obs.call('GetSceneItemList', { sceneName })
    const topItems: any[] = Array.isArray(top?.sceneItems) ? top.sceneItems : []

    // Check for groups named "source <n>" first; if present, inspect their children
    const groupNameByIndex: Record<number, string> = {}
    for (const it of topItems) {
      const n = String(it?.sourceName ?? '')
      const m = /^source\s*(\d+)$/i.exec(n.trim())
      if (m) {
        const idx = Number(m[1])
        if (idx >= 1 && idx <= 4) groupNameByIndex[idx] = n
      }
    }

    const inspectContainer = async (containerName: string, getter: 'GetSceneItemList' | 'GetGroupSceneItemList') => {
      const list = await obs.call(getter, { sceneName: containerName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []
      for (const it of items) {
        const name = String(it?.sourceName ?? '').toLowerCase()
        if (!name) continue
        const on = await enabledOf(containerName, it)
        if (!on) continue
        for (let index = 1; index <= 4; index++) {
          const idxStr = String(index)
          if (name.startsWith('video capture device') && name.includes(idxStr)) result[index].videoCaptureDevice = true
          else if (name.startsWith('rtmp') && name.includes(idxStr)) result[index].rtmp = true
          else if (name.startsWith('webrtc') && name.includes(idxStr)) result[index].webrtc = true
        }
      }
    }

    let inspectedAnyGroup = false
    for (let i = 1; i <= 4; i++) {
      if (groupNameByIndex[i]) {
        inspectedAnyGroup = true
        await inspectContainer(groupNameByIndex[i], 'GetGroupSceneItemList')
      }
    }

    // If no groups exist (flat layout), inspect the scene root items directly
    if (!inspectedAnyGroup) {
      await inspectContainer(sceneName, 'GetSceneItemList')
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


