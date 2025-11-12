import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

type FileNameFormattingResult = {
	preview: string
	ch1: string
	ch2: string
	ch3: string
	ch4: string
}

export async function getFileNameFormatting(): Promise<FileNameFormattingResult> {
	const obs = getObsClient() as any
	if (!obs) {
		return { preview: '', ch1: '', ch2: '', ch3: '', ch4: '' }
	}

	let preview = ''
	try {
		const { parameterValue } = await obs.call('GetProfileParameter', {
			parameterCategory: 'Output',
			parameterName: 'FilenameFormatting',
		})
		preview = typeof parameterValue === 'string' ? parameterValue : ''
	} catch {
		preview = ''
	}

	const sources = ['channel 1', 'channel 2', 'channel 3', 'channel 4']
	const results = ['', '', '', ''] as string[]

	for (let i = 0; i < sources.length; i++) {
		const sourceName = sources[i]
		try {
			const filterName = `Source Record (channel ${i + 1})`
			const { filterSettings } = await obs.call('GetSourceFilter', {
				sourceName,
				filterName,
			})
			const value = filterSettings && typeof filterSettings.filename_formatting === 'string'
				? filterSettings.filename_formatting
				: ''
			results[i] = value
		} catch {
			results[i] = ''
		}
	}

	return {
		preview,
		ch1: results[0] || '',
		ch2: results[1] || '',
		ch3: results[2] || '',
		ch4: results[3] || '',
	}
}

// IPC: get filename formatting from profile and per-channel filters
ipcMain.handle('obs:get-file-name-formatting', async () => {
	try {
		const value = await getFileNameFormatting()
		return value
	} catch {
		return { preview: '', ch1: '', ch2: '', ch3: '', ch4: '' }
	}
})
