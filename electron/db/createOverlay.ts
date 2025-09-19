import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface NewOverlay {
  name: string
}

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

export async function createOverlay(input: NewOverlay): Promise<OverlayDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const overlays = db.collection<OverlayDoc>('overlays')

  const now = new Date()
  const doc = {
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  }

  const result = await overlays.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

export async function closeMongo() {
  if (!cachedClient) return
  try {
    await cachedClient.close()
  } finally {
    cachedClient = null
  }
}


