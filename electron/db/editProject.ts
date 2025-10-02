import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'

export interface EditProjectInput {
  name?: string
  client?: string
  contractor?: string
  vessel?: string
  location?: string
  lastSelectedDiveId?: string | null
  lastSelectedTaskId?: string | null
  lastSelectedNodeId?: string | null
  lastSelectedOverlayCh1Id?: string | null
  lastSelectedOverlayCh2Id?: string | null
  lastSelectedOverlayCh3Id?: string | null
  lastSelectedOverlayCh4Id?: string | null
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
  if (updates.hasOwnProperty('lastSelectedDiveId')) {
    const v = updates.lastSelectedDiveId
    // allow string or null; trim string
    ;(set as any).lastSelectedDiveId = (typeof v === 'string') ? (v.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedTaskId')) {
    const v2 = updates.lastSelectedTaskId
    ;(set as any).lastSelectedTaskId = (typeof v2 === 'string') ? (v2.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedNodeId')) {
    const v3 = updates.lastSelectedNodeId
    ;(set as any).lastSelectedNodeId = (typeof v3 === 'string') ? (v3.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedOverlayCh1Id')) {
    const v4 = updates.lastSelectedOverlayCh1Id
    ;(set as any).lastSelectedOverlayCh1Id = (typeof v4 === 'string') ? (v4.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedOverlayCh2Id')) {
    const v5 = updates.lastSelectedOverlayCh2Id
    ;(set as any).lastSelectedOverlayCh2Id = (typeof v5 === 'string') ? (v5.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedOverlayCh3Id')) {
    const v6 = updates.lastSelectedOverlayCh3Id
    ;(set as any).lastSelectedOverlayCh3Id = (typeof v6 === 'string') ? (v6.trim() || null) : null
  }
  if (updates.hasOwnProperty('lastSelectedOverlayCh4Id')) {
    const v7 = updates.lastSelectedOverlayCh4Id
    ;(set as any).lastSelectedOverlayCh4Id = (typeof v7 === 'string') ? (v7.trim() || null) : null
  }

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

ipcMain.handle('db:editProject', async (_event, projectId: string, updates: EditProjectInput) => {
  try {
    const updated = await editProject(projectId, updates)
    const plain = {
      _id: updated._id.toString(),
      name: updated.name,
      client: updated.client,
      contractor: updated.contractor,
      vessel: updated.vessel,
      location: updated.location,
      projectType: updated.projectType,
      lastSelectedDiveId: updated.lastSelectedDiveId ?? null,
      lastSelectedTaskId: updated.lastSelectedTaskId ?? null,
      lastSelectedNodeId: updated.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: updated.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: updated.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: updated.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: updated.lastSelectedOverlayCh4Id ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

