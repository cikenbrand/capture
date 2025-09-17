import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

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

// IPC: get recording directory from basic.ini
ipcMain.handle('obs:get-recording-directory', async () => {
  try {
    const dir = await getRecordingDirectory()
    return dir
  } catch {
    return ''
  }
})