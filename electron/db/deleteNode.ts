import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { NodeDoc } from './createNode'
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

export async function deleteNode(nodeId: string): Promise<number> {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const rootId = new ObjectId(nodeId)

  // BFS to gather all descendant ids, including the root
  const gathered = new Set<string>([rootId.toHexString()])
  let frontier: ObjectId[] = [rootId]

  while (frontier.length) {
    const children = await nodes
      .find({ parentId: { $in: frontier } }, { projection: { _id: 1 } })
      .toArray()
    const next: ObjectId[] = []
    for (const c of children) {
      const idHex = c._id.toHexString()
      if (!gathered.has(idHex)) {
        gathered.add(idHex)
        next.push(c._id)
      }
    }
    frontier = next
  }

  const idsToDelete = Array.from(gathered).map((hex) => new ObjectId(hex))
  const result = await nodes.deleteMany({ _id: { $in: idsToDelete } })
  return result.deletedCount ?? 0
}

ipcMain.handle('db:deleteNode', async (_event, nodeId: string) => {
  try {
    const deletedCount = await deleteNode(nodeId)
    return { ok: true, data: { deletedCount } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

