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

export async function getSelectedTaskDetails(taskId: string) {
  const client = await getClient()
  const db = client.db('capture')
  const tasks = db.collection<TaskDoc>('tasks')

  const _id = new ObjectId(taskId)
  const doc = await tasks.findOne({ _id })
  return doc
}

ipcMain.handle('db:getSelectedTaskDetails', async (_event, taskId: string) => {
  try {
    if (!taskId || typeof taskId !== 'string') {
      return { ok: false, error: 'Invalid taskId' }
    }
    const doc = await getSelectedTaskDetails(taskId)
    if (!doc) return { ok: true, data: null }
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      name: doc.name,
      remarks: doc.remarks ?? undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


