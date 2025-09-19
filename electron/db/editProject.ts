import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface EditProjectInput {
  name?: string
  client?: string
  contractor?: string
  vessel?: string
  location?: string
}

type ProjectType = 'platform' | 'pipeline'

export interface ProjectDoc {
  _id: ObjectId
  name: string
  client: string
  contractor: string
  vessel: string
  location: string
  projectType: ProjectType
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

export async function editProject(projectId: string, updates: EditProjectInput): Promise<ProjectDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const projects = db.collection<ProjectDoc>('projects')

  const _id = new ObjectId(projectId)

  const now = new Date()
  const set: Partial<ProjectDoc> = { updatedAt: now }

  if (typeof updates.name === 'string') set.name = updates.name.trim()
  if (typeof updates.client === 'string') set.client = updates.client.trim()
  if (typeof updates.contractor === 'string') set.contractor = updates.contractor.trim()
  if (typeof updates.vessel === 'string') set.vessel = updates.vessel.trim()
  if (typeof updates.location === 'string') set.location = updates.location.trim()

  const updated = await projects.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) {
    throw new Error('Project not found')
  }

  return updated
}

