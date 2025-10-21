import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

const AUDIO_INPUT_NAME = 'audio input device'

export async function setAudioInputDevice(deviceId: string): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false
  try {
    // Read current settings to preserve other fields
    const current = await obs.call('GetInputSettings', { inputName: AUDIO_INPUT_NAME })
    const settings = (current?.inputSettings || {}) as Record<string, any>
    // Common property keys for audio inputs
    settings['device_id'] = deviceId
    settings['device'] = deviceId
    await obs.call('SetInputSettings', { inputName: AUDIO_INPUT_NAME, inputSettings: settings, overlay: true })
    return true
  } catch {
    return false
  }
}

ipcMain.handle('obs:set-audio-input', async (_e, deviceId: string) => {
  try {
    const ok = await setAudioInputDevice(String(deviceId))
    return ok === true
  } catch {
    return false
  }
})


