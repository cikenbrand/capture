import { getObsClient } from './connectToOBSWebsocket'

/**
 * Starts recording in OBS and optionally triggers channel hotkeys.
 *
 * - If `preview` is true, calls OBS `StartRecord`.
 * - If `ch1`..`ch4` are true, triggers Ctrl+1..Ctrl+4 via obs-websocket.
 *
 * Returns true if all requested actions succeeded; false otherwise.
 */
export async function startRecording(
	preview: boolean,
	ch1: boolean,
	ch2: boolean,
	ch3: boolean,
	ch4: boolean,
): Promise<boolean> {
	const obs = getObsClient() as any
	if (!obs) return false

	let allOk = true

	// Start recording if requested
	if (preview) {
		try {
			await obs.call('StartRecord')
		} catch {
			allOk = false
		}
	}

	// Helper to trigger a Ctrl+<number> hotkey
	async function triggerCtrlNumber(numberKey: 1 | 2 | 3 | 4): Promise<boolean> {
		const keyId = `OBS_KEY_${numberKey}`
		try {
			await obs.call('TriggerHotkeyByKeySequence', {
				keyId,
				keyModifiers: { shift: false, control: true, alt: false, command: false },
			})
			return true
		} catch {
			return false
		}
	}

	// Trigger requested channel hotkeys sequentially
	if (ch1) allOk = (await triggerCtrlNumber(1)) && allOk
	if (ch2) allOk = (await triggerCtrlNumber(2)) && allOk
	if (ch3) allOk = (await triggerCtrlNumber(3)) && allOk
	if (ch4) allOk = (await triggerCtrlNumber(4)) && allOk

	return allOk
}


