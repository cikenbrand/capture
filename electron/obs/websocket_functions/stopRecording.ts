import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

/**
 * Stops recording in OBS.
 * - Stops Source Record per channel ("channel 1".."channel 4") via vendor `record_stop`.
 * - Stops standard preview recording via `StopRecord`.
 * Returns true if either stop succeeds.
 */
export async function stopRecording(): Promise<boolean> {
    const obs = getObsClient() as any
    if (!obs) return false

    let channelsOk = true
    let previewOk = true

    // Helper to stop Source Record for a specific source name
    async function stopSourceRecord(sourceName: string): Promise<{ success: boolean; error?: string } | undefined> {
        const res = await obs.call('CallVendorRequest', {
            vendorName: 'source-record',
            requestType: 'record_stop',
            requestData: { source: sourceName },
        } as any)
        return res?.responseData
    }

    // Stop Source Record for all channel sources sequentially
    for (const sourceName of ['channel 1', 'channel 2', 'channel 3', 'channel 4']) {
        try {
            const r = await stopSourceRecord(sourceName)
            channelsOk = (!!r?.success) && channelsOk
        } catch {
            channelsOk = false
        }
    }

    // Stop standard preview recording
    try {
        await obs.call('StopRecord')
        previewOk = true
    } catch {
        previewOk = false
    }

    return channelsOk || previewOk
}

ipcMain.handle('obs:stop-recording', async () => {
    try {
      const ok = await stopRecording()
      return ok
    } catch {
      return false
    }
  })
