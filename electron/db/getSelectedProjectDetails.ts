import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'

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

export async function getSelectedProjectDetails(projectId: string) {
  const client = await getClient()
  const db = client.db('capture')
  const projects = db.collection<ProjectDoc>('projects')

  const _id = new ObjectId(projectId)
  const doc = await projects.findOne({ _id })
  return doc
}

ipcMain.handle('db:getSelectedProjectDetails', async (_event, projectId: string) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      return { ok: false, error: 'Invalid projectId' }
    }
    const doc = await getSelectedProjectDetails(projectId)
    if (!doc) return { ok: true, data: null }
    const plain = {
      _id: doc._id.toString(),
      name: doc.name,
      client: doc.client,
      contractor: doc.contractor,
      vessel: doc.vessel,
      location: doc.location,
      projectType: doc.projectType,
      lastSelectedDiveId: doc.lastSelectedDiveId ?? null,
      lastSelectedTaskId: doc.lastSelectedTaskId ?? null,
      lastSelectedNodeId: doc.lastSelectedNodeId ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


