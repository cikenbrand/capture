import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { NodeDoc } from './createNode'

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

export async function deleteNode(nodeId: string): Promise<boolean> {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const result = await nodes.deleteOne({ _id: new ObjectId(nodeId) })
  return result.deletedCount === 1
}

