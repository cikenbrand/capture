import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'
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
  await overlays.updateOne({ _id }, { $set: { name: name.trim(), updatedAt: now } })
  const updated = await overlays.findOne({ _id })
  return updated
}

ipcMain.handle('db:renameOverlay', async (_event, input: { id: string; name: string }) => {
  try {
    if (!input?.id || !input?.name || !input.name.trim()) throw new Error('Invalid input')
    const updated = await renameOverlay(input.id, input.name)
    const idStr = (updated as any)?._id?.toString?.() ?? input.id
    return { ok: true, data: idStr }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


