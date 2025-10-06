import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { getObsClient } from './connectToOBSWebsocket'
import { getRecordingDirectory } from './getRecordingDirectory'

type ChannelsPayload = {
  ch1?: string | boolean
  ch2?: string | boolean
  ch3?: string | boolean
  ch4?: string | boolean
  width?: number
  height?: number
  outputDir?: string
  fileName?: string
}

// Removed timestamp-based naming; file name is provided by renderer

async function resolveSceneName(obs: any, hint: string | boolean | undefined, channelIndex: number): Promise<string | null> {
  if (typeof hint === 'string' && hint.trim()) return hint.trim()
  if (!obs) return null
  try {
    const list = await obs.call('GetSceneList')
    const scenes: any[] = Array.isArray(list?.scenes) ? list.scenes : []
    const normalized = scenes.map(s => ({ raw: String(s?.sceneName ?? ''), low: String(s?.sceneName ?? '').toLowerCase() }))
    const exactOrder = [
      `channel ${channelIndex}`,
      `ch${channelIndex}`,
      `source ${channelIndex}`,
    ]
    // 1) Exact (case-insensitive)
    for (const cand of exactOrder) {
      const m = normalized.find(s => s.low === cand)
      if (m) return m.raw
    }
    // 2) Contains (fallback)
    const containsOrder = [
      `channel ${channelIndex}`,
      `ch${channelIndex}`,
      `source ${channelIndex}`,
      `${channelIndex}`,
    ]
    const cont = normalized.find(s => containsOrder.some(c => s.low.includes(c)))
    return cont ? cont.raw : null
  } catch {
    return null
  }
}

export async function takeSnapshots(payload: ChannelsPayload): Promise<string[]> {
  const obs = getObsClient() as any
  if (!obs) return []

  let outDir = ''
  const preferred = typeof payload?.outputDir === 'string' ? payload.outputDir.trim() : ''
  if (preferred) {
    outDir = preferred
  } else {
    outDir = await getRecordingDirectory()
  }
  try {
    if (outDir && !fs.existsSync(outDir)) {
      await fsp.mkdir(outDir, { recursive: true })
    }
  } catch {}
  const w = Math.max(1, Math.min(3840, Math.floor(Number(payload?.width ?? 0)) || 0)) || undefined
  const h = Math.max(1, Math.min(2160, Math.floor(Number(payload?.height ?? 0)) || 0)) || undefined
  const providedName = (typeof payload?.fileName === 'string' ? payload.fileName.trim() : '')

  const results: string[] = []
  const tasks: Promise<void>[] = []

  const doOne = async (idx: 1 | 2 | 3 | 4, hint?: string | boolean) => {
    const sceneName = await resolveSceneName(obs, hint, idx)
    if (!sceneName) return
    const baseName = providedName || `snapshot_ch${idx}`
    const filePath = path.join(outDir || process.cwd(), `${baseName}.png`)
    try {
      await obs.call('SaveSourceScreenshot', {
        sourceName: sceneName,
        imageFormat: 'png',
        imageFilePath: filePath,
      })
      results.push(filePath)
    } catch {}
  }

  if (payload?.ch1) tasks.push(doOne(1, payload.ch1))
  if (payload?.ch2) tasks.push(doOne(2, payload.ch2))
  if (payload?.ch3) tasks.push(doOne(3, payload.ch3))
  if (payload?.ch4) tasks.push(doOne(4, payload.ch4))

  await Promise.all(tasks)
  return results
}

ipcMain.handle('obs:take-snapshot', async (_e, payload: ChannelsPayload) => {
  try {
    const files = await takeSnapshots(payload || {})
    return { ok: true, data: files }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


