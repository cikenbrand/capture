import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface NewNodes {
  projectId: string
  names: string[]
  parentId?: string
  remarks?: string
}

export interface NodeDoc {
  _id: ObjectId
  projectId: ObjectId
  name: string
  parentId?: ObjectId
  level: number
  status?: 'completed' | 'ongoing' | 'not-started'
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

export async function createNodes(input: NewNodes): Promise<NodeDoc[]> {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const now = new Date()
  const projectObjectId = new ObjectId(input.projectId)

  let level = 0
  let parentObjectId: ObjectId | undefined = undefined

  if (input.parentId) {
    parentObjectId = new ObjectId(input.parentId)
    const parent = await nodes.findOne({ _id: parentObjectId })
    if (!parent) throw new Error('Parent node not found')
    if (!parent.projectId.equals(projectObjectId)) {
      throw new Error('Parent node belongs to a different project')
    }
    level = (parent.level ?? 0) + 1
  }

  const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : undefined
  const names = Array.isArray(input.names) ? input.names.map(n => String(n)).map(n => n.trim()).filter(n => n.length > 0) : []
  if (names.length === 0) throw new Error('At least one node name is required')

  const docs: Array<Omit<NodeDoc, '_id'>> = names.map((nm) => ({
    projectId: projectObjectId,
    name: nm,
    ...(parentObjectId ? { parentId: parentObjectId } : {}) as any,
    ...(remarks ? { remarks } : {}) as any,
    level,
    status: 'not-started',
    createdAt: now,
    updatedAt: now,
  }))

  const result = await nodes.insertMany(docs as any)
  const created: NodeDoc[] = docs.map((doc, idx) => {
    // insertedIds keys are the index positions as strings
    const insertedId = (result.insertedIds as any)[idx]
    return { _id: insertedId, ...(doc as any) }
  })
  return created
}

ipcMain.handle('db:createNode', async (_event, input) => {
  try {
    const created = await createNodes(input)
    return { ok: true, data: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
