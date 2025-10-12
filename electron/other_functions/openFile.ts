import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

ipcMain.handle('system:openFile', async (_e, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: 'invalid file path' }
    }
    const normalized = filePath.trim()
    if (!normalized) return { ok: false, error: 'empty file path' }

    // If no extension, try to resolve by scanning the directory for a matching prefix
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(normalized)
    let toOpen = normalized
    if (!hasExt) {
      try {
        const dir = path.dirname(normalized)
        const base = path.basename(normalized)
        const entries = await fs.readdir(dir)
        const match = entries.find((f) => f.toLowerCase().startsWith(base.toLowerCase() + '.'))
        if (match) {
          toOpen = path.join(dir, match)
        } else {
          // fallback: try mkv
          toOpen = normalized + '.mkv'
        }
      } catch {
        // fallback: try mkv
        toOpen = normalized + '.mkv'
      }
    }

    try {
      await fs.access(toOpen)
    } catch {
      return { ok: false, error: 'file does not exist' }
    }

    const res = await shell.openPath(toOpen)
    if (res && typeof res === 'string' && res.length > 0) {
      return { ok: false, error: res }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

