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


