import OBSWebSocket from 'obs-websocket-js'
import { OBS_WEBSOCKET_URL } from '../../settings'

let obsClient: any | null = null

export function getObsClient(): any | null {
  return obsClient
}

export async function connectToOBSWebsocket(timeoutMs = 4000): Promise<boolean> {
  try {
    if (obsClient) {
      return true
    }

    const client = new OBSWebSocket()

    const connectPromise = client.connect(OBS_WEBSOCKET_URL)
    const timeoutPromise = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        clearTimeout(t)
        reject(new Error('OBS connect timeout'))
      }, timeoutMs)
    })

    await Promise.race([connectPromise, timeoutPromise])
    obsClient = client
    return true
  } catch {
    try { await obsClient?.disconnect() } catch {}
    obsClient = null
    return false
  }
}

