import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { TaskDoc } from './createTask'
import { ipcMain } from 'electron'

export interface EditTaskInput {
  name?: string
  remarks?: string
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

export async function editTask(taskId: string, updates: EditTaskInput): Promise<TaskDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const tasks = db.collection<TaskDoc>('tasks')

  const _id = new ObjectId(taskId)

  const now = new Date()
  const set: Partial<TaskDoc> = { updatedAt: now }

  if (typeof updates.name === 'string') set.name = updates.name.trim()
  if (typeof updates.remarks === 'string') set.remarks = updates.remarks.trim()

  const updated = await tasks.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) {
    throw new Error('Task not found')
  }

  return updated
}

ipcMain.handle('db:editTask', async (_event, taskId, updates) => {
  try {
    const updated = await editTask(taskId, updates)
    return { ok: true, data: updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
