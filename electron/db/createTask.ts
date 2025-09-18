import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface NewTask {
  projectId: string
  name: string
  remarks?: string
}

export interface TaskDoc {
  _id: ObjectId
  projectId: ObjectId
  name: string
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

export async function createTask(input: NewTask): Promise<TaskDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const tasks = db.collection('tasks')

  const now = new Date()
  const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : undefined

  const doc = {
    projectId: new ObjectId(input.projectId),
    name: input.name.trim(),
    ...(remarks ? { remarks } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await tasks.insertOne(doc)
  return { _id: result.insertedId, ...doc } as TaskDoc
}

export async function closeMongo() {
  if (!cachedClient) return
  try {
    await cachedClient.close()
  } finally {
    cachedClient = null
  }
}


