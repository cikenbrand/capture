import { Notification, BrowserWindow } from 'electron'
import { getCOMPorts } from '../serial-data/getCOMPorts'

type StopWatcher = () => void

export function startComDeviceWatcher(getWindow: () => BrowserWindow | null, intervalMs = 1500): StopWatcher {
  let disposed = false
  let last = new Set<string>()
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
      const list = await getCOMPorts()
      const current = new Set(list)

      const added: string[] = []
      const removed: string[] = []

      for (const p of current) if (!last.has(p)) added.push(p)
      for (const p of last) if (!current.has(p)) removed.push(p)

      if (added.length || removed.length) {
        // Notify per port for clarity
        for (const p of added) notify('Serial device connected', p)
        for (const p of removed) notify('Serial device disconnected', p)

        // Inform all renderers (cover all windows)
        try {
          const payload = { added, removed, all: Array.from(current) }
          const primary = getWindow()
          if (primary && !primary.isDestroyed()) {
            primary.webContents.send('serial:ports-changed', payload)
          }
          for (const w of BrowserWindow.getAllWindows()) {
            try { if (!w.isDestroyed()) w.webContents.send('serial:ports-changed', payload) } catch {}
          }
        } catch {}
      }
      last = current
    } catch {}
    finally {
      if (!disposed) timer = setTimeout(tick, intervalMs)
    }
  }

  // Initialize baseline then start polling
  ;(async () => {
    try {
      const initial = await getCOMPorts()
      last = new Set(initial)
    } catch { last = new Set() }
    tick()
  })()

  return () => { disposed = true; if (timer) clearTimeout(timer) }
}


