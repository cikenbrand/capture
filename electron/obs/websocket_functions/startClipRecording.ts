import { getObsClient } from './connectToOBSWebsocket'
import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getActiveSessionId } from '../../getter-setter/activeSession'
import { editSession } from '../../db/editSession'
import { getRecordingDirectory } from './getRecordingDirectory'

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

async function resolveClipFilePath(): Promise<string | null> {
	const obs = getObsClient() as any
	if (!obs) return null

	let outDir = ''
	try {
		outDir = await getRecordingDirectory()
	} catch {
		outDir = ''
	}
	if (!outDir) outDir = process.cwd()

	let filenameFormatting = ''
	let filterSettings: any = null
	try {
		const { filterSettings: fsSettings } = await obs.call('GetSourceFilter', {
			sourceName: 'clip recording',
			filterName: 'source record',
		})
		filterSettings = fsSettings
		const val = fsSettings && typeof fsSettings.filename_formatting === 'string'
			? fsSettings.filename_formatting.trim()
			: ''
		filenameFormatting = val
	} catch {
		filenameFormatting = ''
	}

	if (!filenameFormatting) return null

    const prefixFullPath = path.join(outDir, filenameFormatting)

    // Try to infer extension from known filter settings keys
    const allowed = ['.mkv', '.mp4', '.mov', '.flv', '.m4v']
    let ext = ''
    const candidates = [
        filterSettings?.container,
        filterSettings?.rec_format,
        filterSettings?.format,
        filterSettings?.file_extension,
    ]
    for (const cand of candidates) {
        const s = typeof cand === 'string' ? cand.toLowerCase() : ''
        if (s && allowed.includes(`.${s}`)) {
            ext = `.${s}`
            break
        }
    }

    // Determine file name (may use directory scan if ext unknown)
    let fileName = `${path.basename(filenameFormatting)}${ext}`
    if (!ext) {
        try {
            const files = fs.readdirSync(outDir)
            const found = files.find(f => f.toLowerCase().startsWith(`${path.basename(filenameFormatting).toLowerCase()}.`))
            if (found) fileName = found
        } catch {}
    }

    // Map directory: sibling of recording directory named 'clip'
    let clipDir = outDir
    try {
        const parent = path.dirname(outDir)
        clipDir = path.join(parent, 'clip')
    } catch {}

    return path.join(clipDir, fileName)
}

ipcMain.handle('obs:start-clip-recording', async () => {
	try {
		const ok = await startClipRecording()

		// Fire-and-forget: append expected clip file path to active session
		try {
			if (ok) {
				const sessionId = getActiveSessionId()
				if (sessionId) {
					const clipPath = await resolveClipFilePath()
					if (clipPath) {
						try { await editSession(sessionId, { clips: [clipPath] }) } catch {}
					}
				}
			}
		} catch {}

		return ok
	} catch {
		return false
	}
})

