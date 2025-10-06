import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export async function getClipFileNameFormatting(): Promise<string> {
	const obs = getObsClient() as any
	if (!obs) return ''

	try {
		const { filterSettings } = await obs.call('GetSourceFilter', {
			sourceName: 'clip recording',
			filterName: 'source record',
		})
		const value = filterSettings && typeof filterSettings.filename_formatting === 'string'
			? filterSettings.filename_formatting
			: ''
		return value
	} catch {
		return ''
	}
}

// IPC: get filename formatting for clip recording scene's Source Record filter
ipcMain.handle('obs:get-clip-file-name-formatting', async () => {
	try {
		const value = await getClipFileNameFormatting()
		return value
	} catch {
		return ''
	}
})


