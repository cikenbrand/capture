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
  started?: boolean
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
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error('Dive name is required')
  }
  // Enforce uniqueness of dive name within the same project (case-insensitive)
  const existing = await dives.findOne({
    projectId: new ObjectId(input.projectId),
    name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  })
  if (existing) {
    throw new Error('A dive with this name already exists in this project')
  }
  const doc = {
    projectId: new ObjectId(input.projectId),
    name: trimmedName,
    ...(remarks ? { remarks } : {}),
    started: false,
    createdAt: now,
    updatedAt: now,
  }

  const result = await dives.insertOne(doc)
  return { _id: result.insertedId, ...doc } as DiveDoc
}

ipcMain.handle('db:createDive', async (_event, input) => {
  try {
    const created = await createDive(input)
    const id = (created as any)?._id?.toString?.() ?? created
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
