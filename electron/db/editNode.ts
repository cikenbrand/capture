import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { NodeDoc } from './createNode'

export interface EditNodeInput {
  name?: string
  remarks?: string
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

export async function editNode(nodeId: string, updates: EditNodeInput): Promise<NodeDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const _id = new ObjectId(nodeId)

  const now = new Date()
  const set: Partial<NodeDoc> = { updatedAt: now }

  if (typeof updates.name === 'string') set.name = updates.name.trim()
  if (typeof updates.remarks === 'string') set.remarks = updates.remarks.trim()

  const updated = await nodes.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) {
    throw new Error('Node not found')
  }

  return updated
}

export async function closeMongo() {
  if (!cachedClient) return
  try {
    await cachedClient.close()
  } finally {
    cachedClient = null
  }
}


