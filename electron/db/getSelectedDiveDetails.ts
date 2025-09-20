import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
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

export async function getSelectedDiveDetails(diveId: string) {
  const client = await getClient()
  const db = client.db('capture')
  const dives = db.collection<DiveDoc>('dives')

  const _id = new ObjectId(diveId)
  const doc = await dives.findOne({ _id })
  return doc
}

ipcMain.handle('db:getSelectedDiveDetails', async (_event, diveId: string) => {
  try {
    if (!diveId || typeof diveId !== 'string') {
      return { ok: false, error: 'Invalid diveId' }
    }
    const doc = await getSelectedDiveDetails(diveId)
    if (!doc) return { ok: true, data: null }
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      name: doc.name,
      remarks: doc.remarks ?? undefined,
      started: !!(doc as any).started,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


