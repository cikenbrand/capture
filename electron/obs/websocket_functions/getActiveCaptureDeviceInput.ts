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

  try {
    const top = await obs.call('GetSceneItemList', { sceneName })
    const topItems: any[] = Array.isArray(top?.sceneItems) ? top.sceneItems : []

    // Detect if groups like "source <n>" exist in the scene root
    const groupNameByIndex: Record<number, string> = {}
    for (const it of topItems) {
      const n = String(it?.sourceName ?? '')
      const m = /^source\s*(\d+)$/i.exec(n.trim())
      if (m) {
        const idx = Number(m[1])
        if (idx >= 1 && idx <= 4) groupNameByIndex[idx] = n
      }
    }

    for (let index = 1; index <= 4; index++) {
      const groupName = groupNameByIndex[index]
      if (groupName) {
        // Grouped layout
        try {
          const list = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
          const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []
          const vcd = items.find((it: any) => isVcdName(String(it?.sourceName ?? ''), index))
          if (!vcd) { result[index] = null; continue }
          const inputName = String(vcd?.sourceName ?? '')
          const enabled = await resolveEnabled(obs, groupName, vcd)

          let deviceId: string | undefined
          let deviceName: string | undefined
          try {
            const settings = await obs.call('GetInputSettings', { inputName })
            const s = settings?.inputSettings || {}
            deviceId = String(s?.video_device_id ?? s?.device_id ?? s?.deviceId ?? '') || undefined
          } catch {}
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
          continue
        } catch {
          // If group fetch fails, fall back to flat search below
        }
      }

      // Flat layout: items are directly in the scene root
      const vcd = topItems.find((it: any) => isVcdName(String(it?.sourceName ?? ''), index))
      if (!vcd) { result[index] = null; continue }
      const inputName = String(vcd?.sourceName ?? '')
      const enabled = await resolveEnabled(obs, sceneName, vcd)

      let deviceId: string | undefined
      let deviceName: string | undefined
      try {
        const settings = await obs.call('GetInputSettings', { inputName })
        const s = settings?.inputSettings || {}
        deviceId = String(s?.video_device_id ?? s?.device_id ?? s?.deviceId ?? '') || undefined
      } catch {}
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
    }
  } catch {
    // ignore and return defaults
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


