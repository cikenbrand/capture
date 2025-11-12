import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type DeleteMediaFromChannelResult = { channel: number; removed: boolean }

export async function deleteMediaFromChannel(channel: number): Promise<DeleteMediaFromChannelResult> {
  const obs = getObsClient() as any
  if (!obs) throw new Error('OBS not connected')

  const ch = Number(channel)
  if (!Number.isFinite(ch) || ch < 1 || ch > 4) throw new Error('channel must be 1..4')

  const res = await obs.call('DeleteMediaFromChannel', { channel: ch })
  return { channel: Number(res?.channel ?? ch), removed: !!res?.removed }
}

// IPC
ipcMain.handle('obs:delete-media-from-channel', async (_e, channel: number) => {
  try {
    const data = await deleteMediaFromChannel(channel)
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


