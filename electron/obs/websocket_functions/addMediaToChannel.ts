import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type MediaKind = 'dshow_input' | 'ffmpeg_source'
export type AddMediaToChannelResult = { channel: number; added: boolean }

export async function addMediaToChannel(channel: number, kind: MediaKind = 'dshow_input'): Promise<AddMediaToChannelResult> {
  const obs = getObsClient() as any
  if (!obs) throw new Error('OBS not connected')

  const ch = Number(channel)
  if (!Number.isFinite(ch) || ch < 1 || ch > 4) throw new Error('channel must be 1..4')

  const k = kind === 'ffmpeg_source' ? 'ffmpeg_source' : 'dshow_input'
  const res = await obs.call('AddMediaToChannel', { channel: ch, kind: k })
  return { channel: Number(res?.channel ?? ch), added: !!res?.added }
}

// IPC
ipcMain.handle('obs:add-media-to-channel', async (_e, channel: number, kind?: MediaKind) => {
  try {
    const data = await addMediaToChannel(channel, kind || 'dshow_input')
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


