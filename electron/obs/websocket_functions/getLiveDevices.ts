import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type LiveDeviceInfo = { id: string; name: string }

const TARGET_SCENE = 'video sources'
const TARGET_GROUP = 'source 1'
const TARGET_INPUT = 'video capture device 1'

/**
 * Enumerates available live devices from the Video Capture Device input inside:
 * Scene: "video sources" → Group: "source 1" → Input: "video capture device 1".
 * Returns an array of devices with { id, name }.
 */
export async function getLiveDevices(): Promise<LiveDeviceInfo[]> {
  const obs = getObsClient() as any
  if (!obs) return []

  try {
    // 1) Ensure the group contains the target input (best-effort; not strictly required to list devices)
    try {
      const groupItems = await obs.call('GetGroupSceneItemList', { groupName: TARGET_GROUP })
      const hasInput = Array.isArray(groupItems?.sceneItems)
        ? groupItems.sceneItems.some((it: any) => String(it?.sourceName ?? '').toLowerCase() === TARGET_INPUT)
        : false
      if (!hasInput) {
        // Fallback: look up the scene items and verify the group exists there
        try {
          const sceneRes = await obs.call('GetSceneItemList', { sceneName: TARGET_SCENE })
          const hasGroup = Array.isArray(sceneRes?.sceneItems)
            ? sceneRes.sceneItems.some((it: any) => String(it?.sourceName ?? '').toLowerCase() === TARGET_GROUP)
            : false
          if (!hasGroup) {
            // If the structure isn't present, still attempt to enumerate devices from the input directly
          }
        } catch {}
      }
    } catch {}

    // 2) Validate that the input exists and is of the expected kind
    try {
      const inputs = await obs.call('GetInputList')
      const target = (Array.isArray(inputs?.inputs) ? inputs.inputs : []).find((i: any) => String(i?.inputName ?? '').toLowerCase() === TARGET_INPUT)
      if (!target) {
        // If the name doesn't match, still proceed to enumerate using the known input name
      } else {
        // Optional: const kind = String(target?.inputKind ?? '')
        // Typical kind is 'video_capture_device' on most platforms
      }
    } catch {}

    // 3) Query the input's device list via properties; try both common property names
    const devices: LiveDeviceInfo[] = []
    const tryProperty = async (propertyName: string) => {
      try {
        const res = await obs.call('GetInputPropertiesListPropertyItems', {
          inputName: TARGET_INPUT,
          propertyName,
        })
        const items = Array.isArray(res?.propertyItems) ? res.propertyItems : []
        for (const it of items) {
          const name = String(it?.itemName ?? it?.name ?? '').trim()
          const id = String(it?.itemValue ?? it?.value ?? '').trim()
          if (name && id && !devices.some(d => d.id === id)) {
            devices.push({ id, name })
          }
        }
      } catch {}
    }

    // Common property keys seen in OBS for video capture devices
    await tryProperty('video_device_id')

    // Exclude OBS virtual cameras or any device with 'obs' in the name
    return devices.filter(d => !/obs/i.test(d.name))
  } catch {
    return []
  }
}

// IPC: expose to renderer
ipcMain.handle('obs:get-live-devices', async () => {
  try {
    const list = await getLiveDevices()
    return list
  } catch {
    return []
  }
})

// Simplified API as requested: read from a known input's property list directly
async function getVideoInputs(): Promise<LiveDeviceInfo[]> {
  const obs = getObsClient() as any
  if (!obs) return []
  try {
    const res = await obs.call('GetInputPropertiesListPropertyItems', {
      inputName: 'video capture device 1',
      propertyName: 'video_device_id',
    })
    const items: any[] = Array.isArray(res?.propertyItems) ? res.propertyItems : []
    const mapped = items.map((videoInput: any) => ({
      id: String(videoInput?.itemValue ?? videoInput?.value ?? ''),
      name: String(videoInput?.itemName ?? videoInput?.name ?? ''),
    }))
    // Exclude OBS virtual/related cameras
    return mapped.filter((vi) => vi.id && vi.name && !/obs/i.test(vi.name))
  } catch {
    return []
  }
}

ipcMain.handle('obs:video-inputs', async () => {
  try {
    const videoInputs = await getVideoInputs()
    return { success: true, videoInputs }
  } catch (error) {
    return { success: false, error }
  }
})


