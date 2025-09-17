import { getObsClient } from './connectToOBSWebsocket'

export async function getRecordingDirectory(): Promise<string> {
  const obs = getObsClient() as any
  if (!obs) return ''

  try {
    const { recordDirectory } = await obs.call('GetRecordDirectory')
    return typeof recordDirectory === 'string' ? recordDirectory : ''
  } catch {
    return ''
  }
}


