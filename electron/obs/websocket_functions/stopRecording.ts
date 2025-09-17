import { getObsClient } from './connectToOBSWebsocket'

/**
 * Stops recording in OBS and triggers Ctrl+0 hotkey.
 * Returns true only if both actions succeed.
 */
export async function stopRecording(): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let ok = true

	try {
		await obs.call('StopRecord')
	} catch {
		ok = false
	}

	try {
		await obs.call('TriggerHotkeyByKeySequence', {
			keyId: 'OBS_KEY_0',
			keyModifiers: { shift: false, control: true, alt: false, command: false },
		})
	} catch {
		ok = false
	}

	return ok
}


