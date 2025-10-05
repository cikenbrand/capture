import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

/**
 * Stops a clip recording by triggering Ctrl+6 via obs-websocket.
 */
export async function stopClipRecording(): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	try {
		await obs.call('TriggerHotkeyByKeySequence', {
			keyId: 'OBS_KEY_6',
			keyModifiers: { shift: false, control: true, alt: false, command: false },
		})
		return true
	} catch {
		return false
	}
}

ipcMain.handle('obs:stop-clip-recording', async () => {
	try {
		const ok = await stopClipRecording()
		return ok
	} catch {
		return false
	}
})

