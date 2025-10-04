import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export async function setRecordingDirectory(targetPath: string): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false

  let allOk = true

  try {
    await obs.call('SetRecordDirectory', { recordDirectory: targetPath })
  } catch {
    allOk = false
  }

  const sources = [
    'channel 1',
    'channel 2',
    'channel 3',
    'channel 4',
  ]

  for (const sourceName of sources) {
    try {
      await obs.call('SetSourceFilterSettings', {
        sourceName,
        filterName: 'source record',
        filterSettings: { path: targetPath },
        overlay: true,
      })
    } catch {
      allOk = false
    }
  }

  return allOk
}

ipcMain.handle('obs:set-recording-directory', async (_e, targetPath: string) => {
  try {
    const ok = await setRecordingDirectory(targetPath)
    return ok
  } catch {
    return false
  }
})
