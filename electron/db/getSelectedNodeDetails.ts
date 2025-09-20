import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
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

export async function getSelectedNodeDetails(nodeId: string) {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const _id = new ObjectId(nodeId)
  const doc = await nodes.findOne({ _id })
  return doc
}

ipcMain.handle('db:getSelectedNodeDetails', async (_event, nodeId: string) => {
  try {
    if (!nodeId || typeof nodeId !== 'string') {
      return { ok: false, error: 'Invalid nodeId' }
    }
    const doc = await getSelectedNodeDetails(nodeId)
    if (!doc) return { ok: true, data: null }
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      parentId: doc.parentId ? doc.parentId.toString() : undefined,
      name: doc.name,
      remarks: doc.remarks ?? undefined,
      level: doc.level,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


