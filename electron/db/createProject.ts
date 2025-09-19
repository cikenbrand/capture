import { MongoClient, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export type ProjectType = 'platform' | 'pipeline'

export interface NewProject {
  name: string
  client: string
  contractor: string
  vessel: string
  location: string
  projectType: ProjectType
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

export async function createProject(input: NewProject) {
  const client = await getClient()
  const db = client.db('capture')
  const projects = db.collection('projects')

  const now = new Date()
  const doc = {
    name: input.name.trim(),
    client: input.client.trim(),
    contractor: input.contractor.trim(),
    vessel: input.vessel.trim(),
    location: input.location.trim(),
    projectType: input.projectType,
    createdAt: now,
    updatedAt: now,
  }

  const result = await projects.insertOne(doc)
  return { _id: result.insertedId, ...doc }
}

ipcMain.handle('db:createProject', async (_event, input) => {
  try {
    const created = await createProject(input)
    const id = (created as any)?._id?.toString?.() ?? created
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})