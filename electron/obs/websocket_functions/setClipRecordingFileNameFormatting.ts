import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

/**
 * Sets the Source Record filter's filename formatting for the scene
 * named "clip recording".
 */
export async function setClipRecordingFileNameFormatting(format: string): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let ok = true

	try {
		await obs.call('SetSourceFilterSettings', {
			sourceName: 'clip recording',
			filterName: 'source record',
			filterSettings: { filename_formatting: `clip-${format}` },
			overlay: true,
		})
	} catch {
		ok = false
	}

	return ok
}

// IPC: set filename formatting for clip recording scene's Source Record filter
ipcMain.handle('obs:set-clip-file-name-formatting', async (_e, format: string) => {
	try {
		const ok = await setClipRecordingFileNameFormatting(format)
		return ok
	} catch {
		return false
	}
})


