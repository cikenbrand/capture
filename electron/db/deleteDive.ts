import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { DiveDoc } from './createDive'
import { ipcMain } from 'electron'

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

export async function deleteDive(diveId: string): Promise<boolean> {
  const client = await getClient()
  const db = client.db('capture')
  const dives = db.collection<DiveDoc>('dives')

  const _id = new ObjectId(diveId)
  const res = await dives.deleteOne({ _id })
  return res.deletedCount === 1
}

ipcMain.handle('db:deleteDive', async (_event, diveId: string) => {
  try {
    const ok = await deleteDive(diveId)
    if (!ok) throw new Error('Dive not found')
    return { ok: true, data: diveId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


