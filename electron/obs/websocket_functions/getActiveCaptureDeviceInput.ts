import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type ActiveCaptureInfo = { enabled: boolean; deviceId?: string; deviceName?: string; inputName?: string }
export type ActiveCapturePerScene = { [sourceIndex: number]: ActiveCaptureInfo | null }

function isVcdName(name: string, index: number): boolean {
  const n = String(name || '').toLowerCase().trim()
  return n.startsWith('video capture device') && n.includes(String(index))
}

async function resolveEnabled(obs: any, sceneName: string, sceneItem: any): Promise<boolean> {
  try {
    if (typeof sceneItem?.sceneItemEnabled === 'boolean') return !!sceneItem.sceneItemEnabled
    const en = await obs.call('GetSceneItemEnabled', { sceneName, sceneItemId: Number(sceneItem?.sceneItemId) })
    return !!en?.sceneItemEnabled
  } catch {
    return false
  }
}

export async function getActiveCaptureDeviceInputForScene(sceneName: string): Promise<ActiveCapturePerScene> {
  const obs = getObsClient() as any
  const result: ActiveCapturePerScene = { 1: null, 2: null, 3: null, 4: null }
  if (!obs) return result

  for (let index = 1; index <= 4; index++) {
    const groupName = `source ${index}`
    try {
      const list = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []
      const vcd = items.find((it: any) => isVcdName(String(it?.sourceName ?? ''), index))
      if (!vcd) { result[index] = null; continue }
      const inputName = String(vcd?.sourceName ?? '')
      const enabled = await resolveEnabled(obs, groupName, vcd)

      // Read current device id from input settings
      let deviceId: string | undefined
      let deviceName: string | undefined
      try {
        const settings = await obs.call('GetInputSettings', { inputName })
        const s = settings?.inputSettings || {}
        deviceId = String(s?.video_device_id ?? s?.device_id ?? s?.deviceId ?? '') || undefined
      } catch {}
      // Translate to human name via properties list (fallback to label)
      if (deviceId) {
        try {
          const prop = await obs.call('GetInputPropertiesListPropertyItems', { inputName, propertyName: 'video_device_id' })
          const items = Array.isArray(prop?.propertyItems) ? prop.propertyItems : []
          const match = items.find((it: any) => String(it?.itemValue ?? it?.value ?? '') === deviceId)
          deviceName = String(match?.itemName ?? match?.name ?? '') || undefined
        } catch {}
        if (!deviceName) {
          try {
            const props = await obs.call('GetInputPropertiesListPropertyItems', { inputName, propertyName: 'device' })
            const arr = Array.isArray(props?.propertyItems) ? props.propertyItems : []
            const m = arr.find((it: any) => String(it?.itemValue ?? it?.value ?? '') === deviceId)
            deviceName = String(m?.itemName ?? m?.name ?? '') || undefined
          } catch {}
        }
      }
      result[index] = { enabled, deviceId, deviceName, inputName }
    } catch {
      result[index] = null
    }
  }

  return result
}

ipcMain.handle('obs:get-active-capture-inputs', async (_e, sceneName: string) => {
  try {
    const data = await getActiveCaptureDeviceInputForScene(sceneName)
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


