import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface NewSession {
  projectId: string
  diveId: string
  taskId: string
  nodeIds: string[]
  preview?: string
  ch1?: string
  ch2?: string
  ch3?: string
  ch4?: string
}

export interface SessionDoc {
  _id: ObjectId
  projectId: ObjectId
  diveId: ObjectId
  taskId: ObjectId
  nodeIds: ObjectId[]
  preview?: string
  ch1?: string
  ch2?: string
  ch3?: string
  ch4?: string
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

export async function createSession(input: NewSession): Promise<SessionDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const sessions = db.collection<SessionDoc>('sessions')

  const now = new Date()

  const hasAnyVideo = [input.preview, input.ch1, input.ch2, input.ch3, input.ch4]
    .some(v => typeof v === 'string' && v.trim().length > 0)
  if (!hasAnyVideo) {
    throw new Error('At least one of preview/ch1/ch2/ch3/ch4 must be provided')
  }

  const nodeObjectIds: ObjectId[] = Array.isArray(input.nodeIds)
    ? input.nodeIds
        .map(id => (typeof id === 'string' ? id.trim() : ''))
        .filter(id => id)
        .map(id => new ObjectId(id))
    : []

  const doc: Omit<SessionDoc, '_id'> = {
    projectId: new ObjectId(input.projectId),
    diveId: new ObjectId(input.diveId),
    taskId: new ObjectId(input.taskId),
    nodeIds: nodeObjectIds,
    ...(input.preview && input.preview.trim() ? { preview: input.preview.trim() } : {}),
    ...(input.ch1 && input.ch1.trim() ? { ch1: input.ch1.trim() } : {}),
    ...(input.ch2 && input.ch2.trim() ? { ch2: input.ch2.trim() } : {}),
    ...(input.ch3 && input.ch3.trim() ? { ch3: input.ch3.trim() } : {}),
    ...(input.ch4 && input.ch4.trim() ? { ch4: input.ch4.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await sessions.insertOne(doc as any)
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


