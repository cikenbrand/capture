import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

/**
 * Toggles pause for recording in OBS and triggers Ctrl+P hotkey.
 * Returns true only if both actions succeed.
 */
export async function pauseRecording(): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let ok = true

	try {
		await obs.call('ToggleRecordPause')
	} catch {
		ok = false
	}

	try {
		await obs.call('TriggerHotkeyByKeySequence', {
			keyId: 'OBS_KEY_P',
			keyModifiers: { shift: false, control: true, alt: false, command: false },
		})
	} catch {
		ok = false
	}

	return ok
}

ipcMain.handle('obs:pause-recording', async () => {
	try {
		const ok = await pauseRecording()
		return ok
	} catch {
		return false
	}
})
