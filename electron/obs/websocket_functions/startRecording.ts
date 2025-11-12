import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'
/**
 * Starts OBS preview recording and starts Source Record per selected channels.
 *
 * - If `preview` is true, calls OBS `StartRecord`.
 * - For `ch1`..`ch4`, uses Source Record vendor `record_start` for
 *   sources: "channel 1".."channel 4" (no hotkeys).
 *
 * Returns true if all requested actions succeeded; false otherwise.
 */
export async function startRecording(
	preview: boolean,
	ch1: boolean,
	ch2: boolean,
	ch3: boolean,
	ch4: boolean,
): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let allOk = true

	// Start standard preview recording if requested
	if (preview) {
		try {
			await obs.call('StartRecord')
		} catch {
			allOk = false
		}
	}

	// Helper to start Source Record for a specific source name
	async function startSourceRecord(sourceName: string): Promise<{ success: boolean; error?: string } | undefined> {
		const res = await obs.call('CallVendorRequest', {
			vendorName: 'source-record',
			requestType: 'record_start',
			requestData: { source: sourceName, stop_existing: true },
		} as any)
		return res?.responseData
	}

	// Start requested channel sources sequentially
	if (ch1) {
		try {
			const r = await startSourceRecord('channel 1')
			allOk = (!!r?.success) && allOk
		} catch {
			allOk = false
		}
	}
	if (ch2) {
		try {
			const r = await startSourceRecord('channel 2')
			allOk = (!!r?.success) && allOk
		} catch {
			allOk = false
		}
	}
	if (ch3) {
		try {
			const r = await startSourceRecord('channel 3')
			allOk = (!!r?.success) && allOk
		} catch {
			allOk = false
		}
	}
	if (ch4) {
		try {
			const r = await startSourceRecord('channel 4')
			allOk = (!!r?.success) && allOk
		} catch {
			allOk = false
		}
	}

	return allOk
}

// IPC: start/stop recording
ipcMain.handle('obs:start-recording', async (_e, args: { preview: boolean, ch1: boolean, ch2: boolean, ch3: boolean, ch4: boolean }) => {
	try {
	  const { preview, ch1, ch2, ch3, ch4 } = args || ({} as any)
	  const ok = await startRecording(!!preview, !!ch1, !!ch2, !!ch3, !!ch4)
	  return ok
	} catch {
	  return false
	}
	})