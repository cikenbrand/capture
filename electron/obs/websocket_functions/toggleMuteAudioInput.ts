import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

const AUDIO_INPUT_NAME = 'audio input device'

export async function toggleMuteAudioInput(): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false
  try {
    // Read current mute state
    const status = await obs.call('GetInputMute', { inputName: AUDIO_INPUT_NAME })
    const current = !!status?.inputMuted
    // Toggle
    await obs.call('SetInputMute', { inputName: AUDIO_INPUT_NAME, inputMuted: !current })
    return true
  } catch {
    return false
  }
}

ipcMain.handle('obs:toggle-audio-input-mute', async () => {
  try {
    const ok = await toggleMuteAudioInput()
    return ok === true
  } catch {
    return false
  }
})

export async function getAudioInputMuted(): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false
  try {
    const status = await obs.call('GetInputMute', { inputName: AUDIO_INPUT_NAME })
    return !!status?.inputMuted
  } catch {
    return false
  }
}

ipcMain.handle('obs:get-audio-input-muted', async () => {
  try {
    const muted = await getAudioInputMuted()
    return muted
  } catch {
    return false
  }
})


