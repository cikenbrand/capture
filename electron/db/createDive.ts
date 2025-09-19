import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface NewDive {
  projectId: string
  name: string
  remarks?: string
}

export interface DiveDoc {
  _id: ObjectId
  projectId: ObjectId
  name: string
  remarks?: string
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

export async function createDive(input: NewDive): Promise<DiveDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const dives = db.collection('dives')

  const now = new Date()
  const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : undefined
  const doc = {
    projectId: new ObjectId(input.projectId),
    name: input.name.trim(),
    ...(remarks ? { remarks } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await dives.insertOne(doc)
  return { _id: result.insertedId, ...doc } as DiveDoc
}

ipcMain.handle('db:createDive', async (_event, input) => {
  try {
    const created = await createDive(input)
    return { ok: true, data: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
