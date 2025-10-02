import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type OverlayImageEntry = {
  absolutePath: string
  fileUrl: string
  filename: string
  size: number
  modifiedAt: string
}

function ensureImagesDir(): string {
  if (process.platform !== 'win32') {
    throw new Error('This application supports Windows only')
  }
  const baseDir = app.getPath('userData')
  const imagesDir = path.join(baseDir, 'overlay-images')
  try { fs.mkdirSync(imagesDir, { recursive: true }) } catch {}
  return imagesDir
}

function isAllowedExt(ext: string): boolean {
  const e = ext.toLowerCase()
  return e === '.png' || e === '.jpg' || e === '.jpeg' || e === '.webp' || e === '.bmp'
}

function toFileUrl(p: string): string {
  return `file://${p.replace(/\\/g, '/')}`
}

function listAllImages(): OverlayImageEntry[] {
  const dir = ensureImagesDir()
  let entries: OverlayImageEntry[] = []
  try {
    const files = fs.readdirSync(dir)
    for (const name of files) {
      try {
        const ext = path.extname(name)
        if (!isAllowedExt(ext)) continue
        const full = path.join(dir, name)
        const stat = fs.statSync(full)
        if (!stat.isFile()) continue
        entries.push({
          absolutePath: full,
          fileUrl: toFileUrl(full),
          filename: name,
          size: stat.size,
          modifiedAt: new Date(stat.mtimeMs).toISOString(),
        })
      } catch {}
    }
  } catch {}
  // Sort by modified time desc
  entries.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0))
  return entries
}

ipcMain.handle('fs:getAllOverlayImages', async () => {
  try {
    const items = listAllImages()
    return { ok: true, data: items }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

export {}


