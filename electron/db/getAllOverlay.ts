import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface OverlayDoc {
  _id: ObjectId
  name: string
  createdAt: Date
  updatedAt: Date
}

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

export async function getAllOverlay(): Promise<OverlayDoc[]> {
  const client = await getClient()
  const db = client.db('capture')
  const overlays = db.collection<OverlayDoc>('overlays')
  return overlays.find({}).sort({ createdAt: -1 }).toArray()
}

ipcMain.handle('db:getAllOverlay', async () => {
  try {
    const overlays = await getAllOverlay()
    const plain = overlays.map(o => ({
      _id: o._id.toString(),
      name: o.name,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


