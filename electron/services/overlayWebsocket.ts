import { OVERLAY_WS_PORT } from '../settings'

let wss: any | null = null
let wssPort: number | null = null

export async function startOverlayWebsocketServer(port?: number): Promise<boolean> {
  try {
    if (wss) {
      try { console.log(`[overlay-ws] already running on port ${wssPort ?? 'unknown'}`) } catch {}
      return true
    }

    const resolvedPort = Number(port || OVERLAY_WS_PORT || 3620) || 3620

    // Lazy import to avoid hard dependency crash if package is missing
    const mod: any = await import('ws')
    const WebSocketServer = (mod && (mod.WebSocketServer || (mod as any).Server)) as any
    if (!WebSocketServer) throw new Error('ws module not available')

    wss = new WebSocketServer({ port: resolvedPort })
    wssPort = resolvedPort
    try { console.log(`[overlay-ws] listening on ws://127.0.0.1:${resolvedPort}`) } catch {}

    wss.on('connection', (socket: any) => {
      try {
        socket.on('message', (data: any) => {
          try {
            // Broadcast received payload to all connected clients
            wss?.clients?.forEach((client: any) => {
              try { if (client !== socket && client.readyState === 1) client.send(data) } catch {}
            })
          } catch {}
        })
      } catch {}
    })

    return true
  } catch (err) {
    try { console.warn('[overlay-ws] failed to start:', err) } catch {}
    return false
  }
}

export async function stopOverlayWebsocketServer(): Promise<void> {
  try {
    const s = wss
    wss = null
    wssPort = null
    if (!s) return
    await new Promise<void>((resolve) => {
      try { s.close(() => resolve()) } catch { resolve() }
    })
  } catch {}
}


