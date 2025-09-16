import { getObsClient } from './connectToOBSWebsocket'

/**
 * Sets the current Program scene in OBS via obs-websocket-js.
 * Returns true on success, false if not connected or on error.
 */
export async function setSelectedScene(sceneName: string): Promise<boolean> {
  try {
    const obs = getObsClient() as any
    if (!obs) return false

    await obs.call('SetCurrentProgramScene', { sceneName })
    return true
  } catch {
    return false
  }
}


