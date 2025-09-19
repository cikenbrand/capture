import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { NodeDoc } from './createNode'
import { ipcMain } from 'electron'

export interface TreeNode extends Omit<NodeDoc, 'parentId'> {
  parentId?: ObjectId
  children: TreeNode[]
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

export async function getAllNodes(projectId: string): Promise<TreeNode[]> {
  const client = await getClient()
  const db = client.db('capture')
  const nodesCol = db.collection<NodeDoc>('nodes')

  const projectObjectId = new ObjectId(projectId)
  const nodes = await nodesCol
    .find({ projectId: projectObjectId })
    .sort({ level: 1, createdAt: 1 })
    .toArray()

  const idToNode = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const n of nodes) {
    idToNode.set(n._id.toHexString(), { ...n, children: [] })
  }

  for (const n of nodes) {
    const current = idToNode.get(n._id.toHexString())!
    if (n.parentId) {
      const parent = idToNode.get(n.parentId.toHexString())
      if (parent) parent.children.push(current)
      else roots.push(current) // orphaned parent, treat as root
    } else {
      roots.push(current)
    }
  }

  return roots
}

ipcMain.handle('db:getAllNodes', async (_event, projectId: string) => {
  try {
    const roots = await getAllNodes(projectId)
    const toPlain = (n: any): any => ({
      _id: n._id?.toString?.() ?? n._id,
      projectId: n.projectId?.toString?.() ?? n.projectId,
      parentId: n.parentId ? (n.parentId.toString?.() ?? n.parentId) : undefined,
      name: n.name,
      level: n.level,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      children: Array.isArray(n.children) ? n.children.map(toPlain) : [],
    })
    return { ok: true, data: roots.map(toPlain) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
