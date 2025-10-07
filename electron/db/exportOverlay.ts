import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { getSelectedOverlayLayerId } from '../getter-setter/selectedOverlayLayer'

type ExportInput = {
  /** Destination path. If a directory, a filename will be generated. If .json, used directly. */
  destPath: string
  /** Optional overlayId. If not provided, uses the currently selected overlay. */
  overlayId?: string | null
}

let cachedClient: MongoClient | null = null
async function getClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  })
  await client.connect()
  cachedClient = client
  return client
}

function ensureDirectoryFor(fileOrDir: string): { isFile: boolean; filePath: string } {
  const ext = path.extname(fileOrDir).toLowerCase()
  if (ext === '.json') {
    const dir = path.dirname(fileOrDir)
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    return { isFile: true, filePath: fileOrDir }
  }
  // treat as directory
  const dir = fileOrDir
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  // caller will supply filename later
  return { isFile: false, filePath: dir }
}

function sanitizeName(name: string): string {
  return (name || 'overlay').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'overlay'
}

ipcMain.handle('db:exportOverlay', async (_event, input: ExportInput) => {
  try {
    const destPath = String(input?.destPath || '').trim()
    if (!destPath) throw new Error('destPath is required')

    const client = await getClient()
    const db = client.db('capture')
    const overlays = db.collection('overlays')
    const components = db.collection('overlay_components')

    const selectedId = input?.overlayId && String(input.overlayId).trim()
      ? String(input.overlayId).trim()
      : (getSelectedOverlayLayerId() || '')
    if (!selectedId) throw new Error('No overlay selected')

    const overlay = await overlays.findOne({ _id: new ObjectId(selectedId) }) as any
    if (!overlay) throw new Error('Overlay not found')

    const list = await components.find({ overlayId: new ObjectId(selectedId) }).sort({ createdAt: 1 }).toArray() as any[]

    const exportOverlay = {
      name: String(overlay.name || ''),
      createdAt: overlay.createdAt instanceof Date ? overlay.createdAt.toISOString() : String(overlay.createdAt || ''),
      updatedAt: overlay.updatedAt instanceof Date ? overlay.updatedAt.toISOString() : String(overlay.updatedAt || ''),
    }
    const exportComponents = list.map((c) => ({
      // common
      type: c.type,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      backgroundColor: c.backgroundColor,
      borderColor: c.borderColor,
      radius: c.radius,
      textStyle: c.textStyle,
      customText: c.customText,
      dateFormat: c.dateFormat,
      twentyFourHour: c.twentyFourHour,
      useUTC: c.useUTC,
      dataType: c.dataType,
      nodeLevel: c.nodeLevel,
      projectDetail: c.projectDetail,
      opacity: c.opacity,
      // images: strip path
      imagePath: c.type === 'image' ? '' : c.imagePath,
    }))

    const json = JSON.stringify({ overlay: exportOverlay, components: exportComponents }, null, 2)

    const target = ensureDirectoryFor(destPath)
    let filePath: string
    if (target.isFile) {
      // Always force filename to overlay name when a file path is provided
      const baseDir = path.dirname(target.filePath)
      const base = sanitizeName(exportOverlay.name)
      filePath = path.join(baseDir, `${base}.json`)
    } else {
      const base = sanitizeName(exportOverlay.name)
      filePath = path.join(target.filePath, `${base}.json`)
    }

    fs.writeFileSync(filePath, json, 'utf8')
    return { ok: true, data: { filePath } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

export {}


