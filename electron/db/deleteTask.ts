import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { TaskDoc } from './createTask'
import { ipcMain } from 'electron'

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

export async function deleteTask(taskId: string): Promise<boolean> {
  const client = await getClient()
  const db = client.db('capture')
  const tasks = db.collection<TaskDoc>('tasks')

  const _id = new ObjectId(taskId)
  const res = await tasks.deleteOne({ _id })
  return res.deletedCount === 1
}

ipcMain.handle('db:deleteTask', async (_event, taskId: string) => {
  try {
    const ok = await deleteTask(taskId)
    if (!ok) throw new Error('Task not found')
    return { ok: true, data: taskId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


