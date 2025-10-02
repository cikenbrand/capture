import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { BrowserWindow, ipcMain } from 'electron'
import type { OverlayDoc } from './createOverlay'

let cachedClient: MongoClient | null = null

async function getClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })
  await client.connect()
  cachedClient = client
  return client
}

export async function renameOverlay(id: string, name: string): Promise<OverlayDoc | null> {
  const client = await getClient()
  const db = client.db('capture')
  const overlays = db.collection<OverlayDoc>('overlays')

  const _id = new ObjectId(id)
  const now = new Date()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Overlay name is required')
  // prevent duplicate names (case-insensitive), excluding current _id
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existing = await overlays.findOne({ _id: { $ne: _id }, name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' } } as any)
  if (existing) throw new Error('An overlay with this name already exists')

  await overlays.updateOne({ _id }, { $set: { name: trimmed, updatedAt: now } })
  const updated = await overlays.findOne({ _id })
  return updated
}

ipcMain.handle('db:renameOverlay', async (_event, input: { id: string; name: string }) => {
  try {
    if (!input?.id || !input?.name || !input.name.trim()) throw new Error('Invalid input')
    const updated = await renameOverlay(input.id, input.name)
    const idStr = (updated as any)?._id?.toString?.() ?? input.id
    try {
      const payload = { id: idStr, name: input.name, action: 'renamed' }
      for (const win of BrowserWindow.getAllWindows()) {
        try { win.webContents.send('overlays:changed', payload) } catch {}
      }
    } catch {}
    return { ok: true, data: idStr }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


