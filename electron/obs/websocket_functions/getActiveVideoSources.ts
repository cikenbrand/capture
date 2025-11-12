import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type ChannelSourcesEnabled = Record<string, Record<string, boolean>>

function makeDefault(): ChannelSourcesEnabled {
  const out: ChannelSourcesEnabled = {}
  for (let i = 1; i <= 4; i++) {
    const ch = `channel ${i}`
    out[ch] = {
      [`video capture device ${i}`]: false,
      [`webrtc ${i}`]: false,
      [`rtmp ${i}`]: false,
    }
  }
  return out
}

function normalize(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function getItemEnabled(obs: any, sceneName: string, item: any): Promise<boolean> {
  if (!item) return false
  if (typeof item.sceneItemEnabled === 'boolean') return !!item.sceneItemEnabled
  try {
    const res = await obs.call('GetSceneItemEnabled', {
      sceneName,
      sceneItemId: Number(item.sceneItemId),
    })
    return !!res?.sceneItemEnabled
  } catch {
    return false
  }
}

function findItem(items: any[], prefix: string, index: number): any | null {
  const pfx = normalize(prefix)
  const idx = String(index)
  for (const it of items) {
    const nm = normalize(it?.sourceName)
    if (!nm) continue
    if (nm.startsWith(pfx) && nm.includes(idx)) return it
  }
  return null
}

export async function getChannelSourceEnabledStates(): Promise<ChannelSourcesEnabled> {
  const obs = getObsClient() as any
  if (!obs) return makeDefault()

  const result = makeDefault()

  for (let i = 1; i <= 4; i++) {
    const sceneName = `channel ${i}`
    try {
      const list = await obs.call('GetSceneItemList', { sceneName })
      const items: any[] = Array.isArray(list?.sceneItems) ? list.sceneItems : []

      const vItem = findItem(items, 'video capture device', i)
      const wItem = findItem(items, 'webrtc', i)
      const rItem = findItem(items, 'rtmp', i)

      result[sceneName][`video capture device ${i}`] = await getItemEnabled(obs, sceneName, vItem)
      result[sceneName][`webrtc ${i}`] = await getItemEnabled(obs, sceneName, wItem)
      result[sceneName][`rtmp ${i}`] = await getItemEnabled(obs, sceneName, rItem)
    } catch {
      // keep defaults if scene missing or error
    }
  }

  return result
}

// IPC
ipcMain.handle('obs:get-channel-source-enabled-states', async () => {
  try {
    const data = await getChannelSourceEnabledStates()
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


