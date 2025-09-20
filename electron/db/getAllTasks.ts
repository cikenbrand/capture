import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import type { TaskDoc } from './createTask'

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

export async function getAllTasks(projectId: string): Promise<TaskDoc[]> {
  const client = await getClient()
  const db = client.db('capture')
  const tasks = db.collection<TaskDoc>('tasks')
  return tasks
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: -1 })
    .toArray()
}

ipcMain.handle('db:getAllTasks', async (_event, projectId: string) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      return { ok: false, error: 'projectId is required' }
    }
    const items = await getAllTasks(projectId)
    const plain = items.map(t => ({
      _id: (t._id as any)?.toString?.() ?? t._id,
      projectId: (t.projectId as any)?.toString?.() ?? t.projectId,
      name: t.name,
      remarks: t.remarks,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


