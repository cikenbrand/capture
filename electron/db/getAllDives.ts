import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'
import type { DiveDoc } from './createDive'

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

export async function getAllDives(projectId: string): Promise<DiveDoc[]> {
  const client = await getClient()
  const db = client.db('capture')
  const dives = db.collection<DiveDoc>('dives')
  return dives
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: -1 })
    .toArray()
}

ipcMain.handle('db:getAllDives', async (_event, projectId: string) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      return { ok: false, error: 'projectId is required' }
    }
    const items = await getAllDives(projectId)
    const plain = items.map(d => ({
      _id: (d._id as any)?.toString?.() ?? d._id,
      projectId: (d.projectId as any)?.toString?.() ?? d.projectId,
      name: d.name,
      remarks: d.remarks,
      started: !!(d as any).started,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


