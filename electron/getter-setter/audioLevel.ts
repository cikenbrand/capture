import { BrowserWindow } from 'electron'
import { getObsClient } from '../obs/websocket_functions/connectToOBSWebsocket'

let audioLevelListener: ((data: any) => void) | null = null

export function sendAudioLevel(mainWindow: BrowserWindow): boolean {
  const obs = getObsClient() as any
  if (!obs) return false

  // Avoid attaching multiple listeners
  if (audioLevelListener) return true

  audioLevelListener = (data: any) => {
    try {
      const inputs = Array.isArray(data?.inputs) ? data.inputs : []
      for (const input of inputs) {
        const name = String(input?.inputName ?? '')
        if (name.toLowerCase() !== 'audio input device') continue

        const levels = input?.inputLevelsMul
        if (!Array.isArray(levels) || levels.length === 0) return

        const flat: number[] = ([] as number[]).concat(...levels)
        if (!flat.every((v) => typeof v === 'number' && Number.isFinite(v))) return

        const avg = flat.reduce((sum, v) => sum + v, 0) / (flat.length || 1)
        // Guard against log10(0)
        const safeAvg = avg > 0 ? avg : 1e-12
        const dBValue = 20 * Math.log10(safeAvg)
        const fixedDBValue = Number.isFinite(dBValue) ? dBValue.toFixed(2) : '-inf'

        try { mainWindow.webContents.send('obs:audio-level', fixedDBValue) } catch {}
      }
    } catch {}
  }

	try { obs.on('InputVolumeMeters', audioLevelListener) } catch { audioLevelListener = null; return false }
  return true
}

export function stopSendingAudioLevel(): void {
  const obs = getObsClient() as any
  if (!obs || !audioLevelListener) return
  try { obs.off('InputVolumeMeters', audioLevelListener) } catch {}
  audioLevelListener = null
}


