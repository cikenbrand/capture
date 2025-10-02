import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { OVERLAY_WS_PORT } from '../settings'

type UploadInput = {
  /** Absolute path to an existing image file on disk */
  sourcePath?: string
  /** Base64-encoded image bytes (no data: prefix) */
  bytesBase64?: string
  /** Optional filename to use when bytesBase64 is provided */
  filename?: string
}

type UploadResult = {
  /** Absolute path to the stored image on disk */
  absolutePath: string
  /** file:// URL form of the stored image (useful for Electron renderer) */
  fileUrl: string
  /** HTTP URL served by drawing-service, if available */
  httpUrl: string
  /** Stored filename only */
  filename: string
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

function buildTargetFilename(sourceName: string): string {
  const ext = path.extname(sourceName || '').toLowerCase()
  if (!isAllowedExt(ext)) throw new Error('Unsupported image type')
  const base = path.basename(sourceName, ext)
  const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'image'
  const stamp = new Date()
  const y = stamp.getFullYear()
  const m = String(stamp.getMonth() + 1).padStart(2, '0')
  const d = String(stamp.getDate()).padStart(2, '0')
  const hh = String(stamp.getHours()).padStart(2, '0')
  const mm = String(stamp.getMinutes()).padStart(2, '0')
  const ss = String(stamp.getSeconds()).padStart(2, '0')
  return `${safeBase}_${y}${m}${d}_${hh}${mm}${ss}${ext}`
}

async function handleUpload(input: UploadInput): Promise<UploadResult> {
  if (!input || (typeof input !== 'object')) throw new Error('Invalid input')
  const imagesDir = ensureImagesDir()

  if (input.sourcePath) {
    const src = path.resolve(input.sourcePath)
    const stat = fs.statSync(src)
    if (!stat.isFile()) throw new Error('Source is not a file')
    const filename = buildTargetFilename(path.basename(src))
    const dest = path.join(imagesDir, filename)
    fs.copyFileSync(src, dest)
    const fileUrl = `file://${dest.replace(/\\/g, '/')}`
    const httpUrl = buildHttpUrl(filename)
    return { absolutePath: dest, fileUrl, httpUrl, filename }
  }

  if (input.bytesBase64) {
    const rawName = input.filename && input.filename.trim() ? input.filename.trim() : 'image.png'
    const filename = buildTargetFilename(rawName)
    const dest = path.join(imagesDir, filename)
    const buffer = Buffer.from(input.bytesBase64, 'base64')
    fs.writeFileSync(dest, buffer)
    const fileUrl = `file://${dest.replace(/\\/g, '/')}`
    const httpUrl = buildHttpUrl(filename)
    return { absolutePath: dest, fileUrl, httpUrl, filename }
  }

  throw new Error('Provide either sourcePath or bytesBase64')
}

function buildHttpUrl(filename: string): string {
  try {
    const port = Number(process.env.OVERLAY_WS_PORT || OVERLAY_WS_PORT || 3620) || 3620
    return `http://127.0.0.1:${port}/images/${encodeURIComponent(filename)}`
  } catch {
    return ''
  }
}

ipcMain.handle('fs:uploadOverlayImage', async (_event, input: UploadInput) => {
  try {
    const result = await handleUpload(input)
    return { ok: true, data: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

export {}


