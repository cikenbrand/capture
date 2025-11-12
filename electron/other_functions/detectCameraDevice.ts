import { Notification, BrowserWindow } from 'electron'
import { getDShowDevices, DShowDevice } from '../obs/websocket_functions/getDShowDevices'

type StopWatcher = () => void

function devicesToMap(devs: DShowDevice[]): Map<string, DShowDevice> {
  const m = new Map<string, DShowDevice>()
  for (const d of devs) {
    const id = String(d?.id ?? '').trim()
    if (!id) continue
    m.set(id, { id, name: String(d?.name ?? '') })
  }
  return m
}

export function startCameraDeviceWatcher(getWindow: () => BrowserWindow | null, intervalMs = 2000): StopWatcher {
  let disposed = false
  let last = new Map<string, DShowDevice>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const notify = (title: string, body: string) => {
    try {
      const n = new Notification({ title, body, silent: false })
      n.show()
    } catch {}
  }

  const tick = async () => {
    if (disposed) return
    try {
      const res = await getDShowDevices()
      const list = Array.isArray(res?.devices) ? res.devices : []
      const current = devicesToMap(list)

      const added: DShowDevice[] = []
      const removed: DShowDevice[] = []

      for (const [id, dev] of current) if (!last.has(id)) added.push(dev)
      for (const [id, dev] of last) if (!current.has(id)) removed.push(dev)

      if (added.length || removed.length) {
        for (const d of added) notify('Camera connected', d.name || d.id)
        for (const d of removed) notify('Camera disconnected', d.name || d.id)

        try {
          const payload = { added, removed, all: Array.from(current.values()) }
          const primary = getWindow()
          if (primary && !primary.isDestroyed()) {
            primary.webContents.send('camera:devices-changed', payload)
          }
          for (const w of BrowserWindow.getAllWindows()) {
            try { if (!w.isDestroyed()) w.webContents.send('camera:devices-changed', payload) } catch {}
          }
        } catch {}
      }
      last = current
    } catch {}
    finally {
      if (!disposed) timer = setTimeout(tick, intervalMs)
    }
  }

  ;(async () => {
    try {
      const res = await getDShowDevices()
      last = devicesToMap(Array.isArray(res?.devices) ? res.devices : [])
    } catch { last = new Map() }
    tick()
  })()

  return () => { disposed = true; if (timer) clearTimeout(timer) }
}




