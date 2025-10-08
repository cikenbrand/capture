import { ipcMain } from 'electron'
import { openSerialDevice, type DataBits as DataBitsNum, type StopBits as StopBitsNum, type Parity as ParityVal, type SerialLiveData } from '../serial-data/openSerialDevice'
import { OVERLAY_WS_PORT } from '../settings'

export type SerialDeviceState = {
  device: string | null
  baudRate: string
  dataBits: string
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  stopBits: '1' | '2'
  flowControl: 'none' | 'rtscts' | 'xonxoff'
  isOpen: boolean
  data: string[]
  currentFields: { key: string | null, value: string }[]
}

let serialDeviceState: SerialDeviceState = {
  device: null,
  baudRate: '9600',
  dataBits: '8',
  parity: 'none',
  stopBits: '1',
  flowControl: 'none',
  isOpen: false,
  data: [],
  currentFields: [],
}

export function getSerialDeviceState(): SerialDeviceState {
  return serialDeviceState
}

export function updateSerialDeviceState(patch: Partial<SerialDeviceState>) {
  serialDeviceState = { ...serialDeviceState, ...patch }
}

ipcMain.handle('serial:getDeviceState', async () => {
  try {
    return { ok: true, data: getSerialDeviceState() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('serial:updateDeviceState', async (_e, patch: Partial<SerialDeviceState>) => {
  try {
    updateSerialDeviceState(patch || {})
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

let live: SerialLiveData | null = null

let lastBroadcastAt = 0
async function broadcastSerialSnapshot(isOpen: boolean, fields: { key: string | null, value: string }[]) {
  try {
    const now = Date.now()
    if (now - lastBroadcastAt < 150) {
      // throttle to ~6-7 fps
      return
    }
    lastBroadcastAt = now
    const mod: any = await import('ws')
    const WS = (mod && (mod.WebSocket || mod.default)) as any
    const payload = JSON.stringify({ serial: { isOpen, fields } })
    for (let ch = 1; ch <= 4; ch++) {
      try {
        const ws = new WS(`ws://127.0.0.1:${OVERLAY_WS_PORT || 3620}/overlay?ch=${ch}`)
        const sendOnce = () => {
          try { ws.send(payload) } catch {}
          try { ws.close() } catch {}
        }
        ws.on('open', sendOnce)
        // If already open (unlikely), send immediately
        try { if (ws.readyState === 1) sendOnce() } catch {}
      } catch {}
    }
  } catch {}
}

async function openCurrentSerial(): Promise<boolean> {
  if (live) return true
  const cfg = getSerialDeviceState()
  if (!cfg.device) return false
  try {
    const baud = Number(cfg.baudRate) || 9600
    const dataBits = Number(cfg.dataBits) as DataBitsNum
    const stopBits = Number(cfg.stopBits) as StopBitsNum
    const parity = cfg.parity as ParityVal
    const conn = await openSerialDevice(cfg.device, baud, stopBits, dataBits, parity)
    live = conn
    serialDeviceState.isOpen = true
    const onData = (chunk: Buffer | string) => {
      try {
        const line = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        // Append to history; keep last 1000 entries to bound memory
        serialDeviceState.data.push(line)
        if (serialDeviceState.data.length > 1000) serialDeviceState.data.splice(0, serialDeviceState.data.length - 1000)
        // Parse by comma into fields from the latest line; preserve existing keys by index
        const parts = line.split(',').map(s => s.trim())
        const prev = serialDeviceState.currentFields
        serialDeviceState.currentFields = parts.map((v, i) => ({ key: prev?.[i]?.key ?? null, value: v }))
        void broadcastSerialSnapshot(true, serialDeviceState.currentFields)
      } catch {}
    }
    const onError = (_err: Error) => {}
    const onClose = () => {
      serialDeviceState.isOpen = false
      serialDeviceState.data = []
      serialDeviceState.currentFields = []
      live = null
      void broadcastSerialSnapshot(false, [])
    }
    conn.onData(onData)
    conn.onError(onError)
    conn.onClose(onClose)
    return true
  } catch {
    try { await closeCurrentSerial() } catch {}
    return false
  }
}

async function closeCurrentSerial(): Promise<boolean> {
  if (!live) return true
  try {
    await live.close()
  } catch {}
  live = null
  serialDeviceState.isOpen = false
  serialDeviceState.data = []
  serialDeviceState.currentFields = []
  return true
}

ipcMain.handle('serial:toggleOpen', async () => {
  try {
    if (serialDeviceState.isOpen) {
      await closeCurrentSerial()
      return { ok: true, data: { isOpen: false } }
    } else {
      const ok = await openCurrentSerial()
      return { ok: ok === true, data: { isOpen: ok === true } }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('serial:setFieldKey', async (_e, index: number, key: string | null) => {
  try {
    if (!Array.isArray(serialDeviceState.currentFields)) serialDeviceState.currentFields = []
    while (serialDeviceState.currentFields.length <= index) {
      serialDeviceState.currentFields.push({ key: null, value: '' })
    }
    serialDeviceState.currentFields[index].key = (key && key.trim()) ? key : null
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


