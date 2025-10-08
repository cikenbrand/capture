import { MongoClient, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
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

export async function createDataKey(name: string): Promise<string> {
  const client = await getClient()
  const db = client.db('capture')
  const collection = db.collection('dataKeys')

  const keyName = (name ?? '').trim()
  if (!keyName) throw new Error('Key name is required')

  const now = new Date()
  const doc = { name: keyName, createdAt: now, updatedAt: now }
  const result = await collection.insertOne(doc)
  return result.insertedId.toString()
}

ipcMain.handle('db:createDataKey', async (_event, name: string) => {
  try {
    const id = await createDataKey(name)
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


