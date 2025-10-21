import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type AudioDeviceInfo = { id: string; name: string }

const AUDIO_INPUT_NAME = 'audio input device'

async function listPropertyItems(inputName: string, propertyName: string): Promise<Array<{ id: string; name: string }>> {
  const obs = getObsClient() as any
  if (!obs) return []
  try {
    const res = await obs.call('GetInputPropertiesListPropertyItems', { inputName, propertyName })
    const items: any[] = Array.isArray(res?.propertyItems) ? res.propertyItems : []
    return items
      .map(it => ({ id: String(it?.itemValue ?? it?.value ?? ''), name: String(it?.itemName ?? it?.name ?? '') }))
      .filter(d => d.id && d.name)
  } catch {
    return []
  }
}

export async function getAudioInputs(): Promise<AudioDeviceInfo[]> {
  // Query common property keys for audio inputs; dedupe by id
  const results: AudioDeviceInfo[] = []
  const pushUnique = (arr: Array<{ id: string; name: string }>) => {
    for (const it of arr) {
      if (!results.some(x => x.id === it.id)) results.push({ id: it.id, name: it.name })
    }
  }

  // Windows WASAPI usually uses 'device_id'; some platforms expose 'device'
  pushUnique(await listPropertyItems(AUDIO_INPUT_NAME, 'device_id'))
  pushUnique(await listPropertyItems(AUDIO_INPUT_NAME, 'device'))

  return results
}

// IPC: expose to renderer as a simple array of { id, name }
ipcMain.handle('obs:get-audio-inputs', async () => {
  try {
    const list = await getAudioInputs()
    return list
  } catch {
    return []
  }
})


