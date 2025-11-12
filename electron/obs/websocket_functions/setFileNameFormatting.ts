import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export async function setFileNameFormatting(format: string): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let allOk = true

	try {
		await obs.call('SetProfileParameter', {
			parameterCategory: 'Output',
			parameterName: 'FilenameFormatting',
			parameterValue: `preview-${format}`,
		})
	} catch {
		allOk = false
	}

	const sources = [
		'channel 1',
		'channel 2',
		'channel 3',
		'channel 4',
	]

	for (let i = 0; i < sources.length; i++) {
		const sourceName = sources[i]
		const channelIndex = i + 1
		try {
			const filterName = `Source Record (channel ${channelIndex})`
			await obs.call('SetSourceFilterSettings', {
				sourceName,
				filterName,
				filterSettings: { filename_formatting: `ch${channelIndex}-${format}` },
				overlay: true,
			})
		} catch {
			allOk = false
		}
	}

	return allOk
}

// IPC: set filename formatting in profile parameter
ipcMain.handle('obs:set-file-name-formatting', async (_e, format: string) => {
	try {
		const ok = await setFileNameFormatting(format)
		return ok
	} catch {
		return false
	}
})


