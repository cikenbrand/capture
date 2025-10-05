import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'

/**
 * Resumes recording in OBS and triggers Ctrl+R hotkey.
 * Returns true only if both actions succeed.
 */
export async function resumeRecording(): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let ok = true

	try {
		await obs.call('ResumeRecord')
	} catch {
		ok = false
	}

	try {
		await obs.call('TriggerHotkeyByKeySequence', {
			keyId: 'OBS_KEY_R',
			keyModifiers: { shift: false, control: true, alt: false, command: false },
		})
	} catch {
		ok = false
	}

	return ok
}

ipcMain.handle('obs:resume-recording', async () => {
	try {
		const ok = await resumeRecording()
		return ok
	} catch {
		return false
	}
})

