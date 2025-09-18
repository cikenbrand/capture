import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface NewNode {
  projectId: string
  name: string
  parentId?: string
  remarks?: string
}

export interface NodeDoc {
  _id: ObjectId
  projectId: ObjectId
  name: string
  parentId?: ObjectId
  level: number
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

export async function createNode(input: NewNode): Promise<NodeDoc> {
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
  const doc: Omit<NodeDoc, '_id'> & Partial<Pick<NodeDoc, 'parentId' | 'remarks'>> = {
    projectId: projectObjectId,
    name: input.name.trim(),
    ...(parentObjectId ? { parentId: parentObjectId } : {}),
    ...(remarks ? { remarks } : {}),
    level,
    createdAt: now,
    updatedAt: now,
  }

  const result = await nodes.insertOne(doc as any)
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


