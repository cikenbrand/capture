import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type DeleteInput = {
  filename?: string
  fileUrl?: string
  httpUrl?: string
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

function extractFilenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop() || ''
    return last || null
  } catch {
    // Fallback: treat as plain string path
    const last = url.split(/[\\/]/).filter(Boolean).pop() || ''
    return last || null
  }
}

function resolveTargetPath(input: DeleteInput): { dir: string; full: string; filename: string } {
  const dir = ensureImagesDir()
  let filename = (input.filename || '').trim()
  if (!filename && input.fileUrl) filename = extractFilenameFromUrl(input.fileUrl) || ''
  if (!filename && input.httpUrl) filename = extractFilenameFromUrl(input.httpUrl) || ''
  if (!filename) throw new Error('filename, fileUrl, or httpUrl required')

  // sanitize and validate extension
  const ext = path.extname(filename)
  if (!isAllowedExt(ext)) throw new Error('Unsupported image type')
  const base = path.basename(filename)
  const full = path.join(dir, base)

  // ensure path is inside images dir
  const rel = path.relative(dir, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid path')
  return { dir, full, filename: base }
}

function deleteImageFile(full: string) {
  try {
    const stat = fs.statSync(full)
    if (!stat.isFile()) throw new Error('Not a file')
  } catch (err) {
    // If file does not exist, consider it already deleted
    if ((err as any)?.code === 'ENOENT') return
    throw err
  }
  fs.unlinkSync(full)
}

ipcMain.handle('fs:deleteOverlayImage', async (_event, input: DeleteInput) => {
  try {
    const { full, filename } = resolveTargetPath(input || {})
    deleteImageFile(full)
    return { ok: true, data: { filename } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

export {}


