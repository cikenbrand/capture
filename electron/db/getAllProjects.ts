import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export type ProjectType = 'platform' | 'pipeline'

export interface ProjectDoc {
  _id: ObjectId
  name: string
  client: string
  contractor: string
  vessel: string
  location: string
  projectType: ProjectType
  lastSelectedDiveId?: string | null
  lastSelectedTaskId?: string | null
  lastSelectedNodeId?: string | null
  lastSelectedOverlayCh1Id?: string | null
  lastSelectedOverlayCh2Id?: string | null
  lastSelectedOverlayCh3Id?: string | null
  lastSelectedOverlayCh4Id?: string | null
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

export async function getAllProjects(): Promise<ProjectDoc[]> {
  const client = await getClient()
  const db = client.db('capture')
  const projects = db.collection<ProjectDoc>('projects')
  return projects.find({}).sort({ createdAt: -1 }).toArray()
}

ipcMain.handle('db:getAllProjects', async () => {
  try {
    const projects = await getAllProjects()
    // Convert ObjectIds to strings for renderer
    const plain = projects.map(p => ({
      _id: p._id.toString(),
      name: p.name,
      client: p.client,
      contractor: p.contractor,
      vessel: p.vessel,
      location: p.location,
      projectType: p.projectType,
      lastSelectedDiveId: p.lastSelectedDiveId ?? null,
      lastSelectedTaskId: p.lastSelectedTaskId ?? null,
      lastSelectedNodeId: p.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: p.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: p.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: p.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: p.lastSelectedOverlayCh4Id ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
