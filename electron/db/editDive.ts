import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { DiveDoc } from './createDive'
import { ipcMain } from 'electron'

export interface EditDiveInput {
  name?: string
  remarks?: string
  started?: boolean
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

export async function editDive(diveId: string, updates: EditDiveInput): Promise<DiveDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const dives = db.collection<DiveDoc>('dives')

  const _id = new ObjectId(diveId)

  const now = new Date()
  const set: Partial<DiveDoc> = { updatedAt: now }

  if (typeof updates.name === 'string') set.name = updates.name.trim()
  if (typeof updates.remarks === 'string') set.remarks = updates.remarks.trim()
  if (typeof updates.started === 'boolean') set.started = updates.started

  const updated = await dives.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) {
    throw new Error('Dive not found')
  }

  return updated
}

ipcMain.handle('db:editDive', async (_event, diveId, updates) => {
  try {
    const updated = await editDive(diveId, updates)
    return { ok: true, data: updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
