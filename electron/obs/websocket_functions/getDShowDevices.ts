import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type DShowDevice = { id: string; name: string }
export type SelectedChannels = {
  channel1?: DShowDevice
  channel2?: DShowDevice
  channel3?: DShowDevice
  channel4?: DShowDevice
}
export type DShowDevicesResult = {
  devices: DShowDevice[]
  selected?: SelectedChannels
}

function normalizeDevice(raw: any): DShowDevice | null {
  const id = String(raw?.id ?? '').trim()
  const name = String(raw?.name ?? '').trim()
  if (!id && !name) return null
  return { id, name }
}

export async function getDShowDevices(): Promise<DShowDevicesResult> {
  const obs = getObsClient() as any
  if (!obs) return { devices: [] }

  try {
    const res = await obs.call('GetDShowDevices')
    const devicesArr: any[] = Array.isArray(res?.devices) ? res.devices : []
    const devices: DShowDevice[] = []
    for (const it of devicesArr) {
      const d = normalizeDevice(it)
      if (d) devices.push(d)
    }

    const selectedRaw: any = res?.selected || {}
    const selected: SelectedChannels = {}
    if (selectedRaw && typeof selectedRaw === 'object') {
      const assignIf = (key: keyof SelectedChannels, v: any) => {
        const d = normalizeDevice(v)
        if (d) (selected as any)[key] = d
      }
      assignIf('channel1', selectedRaw.channel1)
      assignIf('channel2', selectedRaw.channel2)
      assignIf('channel3', selectedRaw.channel3)
      assignIf('channel4', selectedRaw.channel4)
    }

    return Object.keys(selected).length > 0 ? { devices, selected } : { devices }
  } catch {
    return { devices: [] }
  }
}

// IPC: expose to renderer
ipcMain.handle('obs:get-dshow-devices', async () => {
  try {
    const data = await getDShowDevices()
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


