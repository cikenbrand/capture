import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

/**
 * Starts a clip recording by triggering Ctrl+5 via obs-websocket.
 */
export async function startClipRecording(): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	try {
		await obs.call('TriggerHotkeyByKeySequence', {
			keyId: 'OBS_KEY_5',
			keyModifiers: { shift: false, control: true, alt: false, command: false },
		})
		return true
	} catch {
		return false
	}
}

ipcMain.handle('obs:start-clip-recording', async () => {
	try {
		const ok = await startClipRecording()
		return ok
	} catch {
		return false
	}
})

