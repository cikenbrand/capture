import OBSWebSocket, { EventSubscription } from "obs-websocket-js";
import { OBS_WEBSOCKET_URL } from '../../settings'

let obsClient: any | null = null
let connecting: Promise<void> | null = null

// v5 dah tak export EventSubscription; guna bitmask sendiri
// InputVolumeMeters = 1 << 9
const EVENT_SUB_INPUT_VOLUME_METERS = 1 << 9

export function getObsClient(): any | null {
  return obsClient
}

export async function connectToOBSWebsocket(timeoutMs = 4000): Promise<boolean> {
  // kalau dah ada connection, terus true
  if (obsClient) return true

  // kalau tengah connecting, tunggu yang sama (elak buka dua kali)
  if (connecting) {
    try {
      await withTimeout(connecting, timeoutMs)
      return !!obsClient
    } catch {
      return false
    }
  }

  const client = new OBSWebSocket()

  // `connect(url?, password?, options?)`
  connecting = client
    .connect(OBS_WEBSOCKET_URL, undefined, {
      eventSubscriptions: EventSubscription.InputVolumeMeters,
    })
    .then(() => {
      obsClient = client
      try { console.log('[obs] connected; subscribed InputVolumeMeters') } catch {}
    })
    .finally(() => {
      connecting = null
    })

  try {
    await withTimeout(connecting, timeoutMs)
    return true
  } catch {
    // timeout / gagal connect → pastikan clean
    try { await client.disconnect() } catch {}
    obsClient = null
    return false
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('OBS connect timeout')), ms)
    p.then(
      v => { clearTimeout(id); resolve(v) },
      e => { clearTimeout(id); reject(e) }
    )
  })
}
