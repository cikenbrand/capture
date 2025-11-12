import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type SetDShowDeviceArgs = { channel: number; deviceId: string }
export type SetDShowDeviceResult = { channel: number; deviceId: string }

export async function setDShowDeviceToChannel(args: SetDShowDeviceArgs): Promise<SetDShowDeviceResult> {
  const obs = getObsClient() as any
  if (!obs) throw new Error('OBS not connected')

  const channel = Number(args?.channel)
  const deviceId = String(args?.deviceId ?? '').trim()
  if (!Number.isFinite(channel) || channel < 1 || channel > 4) throw new Error('channel must be 1..4')
  if (!deviceId) throw new Error('deviceId must be non-empty')

  // Call custom OBS WebSocket request implemented in native code
  const res = await obs.call('SetDShowDeviceToChannel', { channel, deviceId })
  const out: SetDShowDeviceResult = {
    channel: Number(res?.channel ?? channel),
    deviceId: String(res?.deviceId ?? deviceId),
  }
  return out
}

// IPC: expose to renderer
ipcMain.handle('obs:set-dshow-device', async (_e, channel: number, deviceId: string) => {
  try {
    const data = await setDShowDeviceToChannel({ channel, deviceId })
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


