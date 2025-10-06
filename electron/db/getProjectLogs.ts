import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface ProjectLogItem {
  _id: string
  projectId: string
  date: string
  time: string
  event: string
  dive?: string | null
  task?: string | null
  components?: unknown
  fileName?: string | null
  anomaly?: string | null
  remarks?: string | null
  data?: unknown
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

export async function getProjectLogs(projectId: string, limit = 100, offset = 0): Promise<ProjectLogItem[]> {
  const client = await getClient()
  const db = client.db('capture')
  const logs = db.collection('project_logs')

  const _pid = new ObjectId(String(projectId))
  const cursor = logs
    .find({ projectId: _pid })
    .sort({ createdAt: -1 })
    .skip(Math.max(0, offset | 0))
    .limit(Math.max(1, Math.min(1000, limit | 0)))

  const raw = await cursor.toArray()
  return raw.map((d: any) => ({
    _id: String(d._id),
    projectId: String(d.projectId),
    date: String(d.date ?? ''),
    time: String(d.time ?? ''),
    event: String(d.event ?? ''),
    dive: d.dive ?? null,
    task: d.task ?? null,
    components: d.components,
    fileName: d.fileName ?? null,
    anomaly: d.anomaly ?? null,
    remarks: d.remarks ?? null,
    data: d.data,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }))
}

ipcMain.handle('db:getProjectLogs', async (_event, projectId: string, opts?: { limit?: number, offset?: number }) => {
  try {
    if (!projectId || typeof projectId !== 'string') return { ok: false, error: 'Invalid projectId' }
    const limit = Math.max(1, Math.min(1000, Number(opts?.limit ?? 200) || 200))
    const offset = Math.max(0, Number(opts?.offset ?? 0) || 0)
    const list = await getProjectLogs(projectId, limit, offset)
    return { ok: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


