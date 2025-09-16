import { getObsClient } from './connectToOBSWebsocket'

/**
 * Returns the current Program scene name from OBS via obs-websocket-js.
 * If not connected or an error occurs, returns an empty string.
 */
export async function getCurrentSceneName(): Promise<string> {
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


