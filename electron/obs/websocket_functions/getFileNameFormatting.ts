import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export async function getFileNameFormatting(): Promise<string> {
	const obs = getObsClient() as any
	if (!obs) return ''

	try {
		const { parameterValue } = await obs.call('GetProfileParameter', {
			parameterCategory: 'Output',
			parameterName: 'FilenameFormatting',
		})
		return typeof parameterValue === 'string' ? parameterValue : ''
	} catch {
		return ''
	}
}

// IPC: get filename formatting from profile parameter
ipcMain.handle('obs:get-file-name-formatting', async () => {
	try {
	  const value = await getFileNameFormatting()
	  return value
	} catch {
	  return ''
	}
  })
  
