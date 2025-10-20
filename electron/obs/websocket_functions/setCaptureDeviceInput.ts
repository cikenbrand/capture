import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

function isVcdName(name: string, index: number): boolean {
  const n = String(name || '').toLowerCase().trim()
  return n.startsWith('video capture device') && n.includes(String(index))
}

export async function setCaptureDeviceInput(sceneName: string, sourceIndex: number, deviceId: string): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs || !deviceId) return false

  // Flat scene layout: search directly in the scene root
  let vcd: any | undefined
  try {
    const res = await obs.call('GetSceneItemList', { sceneName })
    const children: any[] = Array.isArray(res?.sceneItems) ? res.sceneItems : []
    vcd = children.find((it: any) => isVcdName(String(it?.sourceName ?? ''), sourceIndex))
  } catch {
    vcd = undefined
  }
  if (!vcd) return false

  const inputName = String(vcd?.sourceName ?? '')
  try {
    // Read existing settings to preserve other fields
    const current = await obs.call('GetInputSettings', { inputName })
    const settings = (current?.inputSettings || {}) as Record<string, any>
    // Set both commonly used keys to maximize compatibility across platforms
    settings['video_device_id'] = deviceId
    settings['device_id'] = deviceId
    await obs.call('SetInputSettings', { inputName, inputSettings: settings, overlay: true })
    return true
  } catch {
    return false
  }
}

ipcMain.handle('obs:set-capture-device-input', async (_e, sceneName: string, sourceIndex: number, deviceId: string) => {
  try {
    const ok = await setCaptureDeviceInput(sceneName, Number(sourceIndex), String(deviceId))
    return ok === true
  } catch {
    return false
  }
})


