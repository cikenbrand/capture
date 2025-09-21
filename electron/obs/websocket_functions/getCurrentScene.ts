import { getObsClient } from './connectToOBSWebsocket'

/**
 * Gets the current Program scene name from OBS via obs-websocket-js.
 * Returns the scene name on success, or an empty string if not connected or on error.
 */
export async function getCurrentScene(): Promise<string> {
  try {
    const obs = getObsClient() as any
    if (!obs) return ''

    const res = await obs.call('GetCurrentProgramScene')
    const name = (res as any)?.currentProgramSceneName ?? ''
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}




