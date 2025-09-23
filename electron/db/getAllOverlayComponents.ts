import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import type { OverlayComponentDoc } from './createOverlayComponent'

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

export async function getAllOverlayComponents(overlayId?: string): Promise<Pick<OverlayComponentDoc, '_id' | 'name'>[]> {
  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')
  const filter = overlayId ? { overlayId: new ObjectId(overlayId) } : {}
  const cursor = components.find(filter, { projection: { _id: 1, name: 1 } }).sort({ createdAt: -1 })
  return cursor.toArray()
}

ipcMain.handle('db:getAllOverlayComponents', async (_event, input?: { overlayId?: string }) => {
  try {
    const items = await getAllOverlayComponents(input?.overlayId)
    const plain = items.map(i => ({ _id: i._id.toString(), name: i.name }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


