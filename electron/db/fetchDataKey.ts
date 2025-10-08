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

export type DataKey = { _id: string; name: string; createdAt: Date; updatedAt: Date }

export async function fetchDataKeys(): Promise<DataKey[]> {
  const client = await getClient()
  const db = client.db('capture')
  const collection = db.collection('dataKeys')
  const docs = await collection.find({}).sort({ createdAt: 1 }).toArray()
  return docs.map((d: any) => ({
    _id: d._id?.toString?.() ?? String(d._id),
    name: d.name,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }))
}

ipcMain.handle('db:fetchDataKeys', async () => {
  try {
    const keys = await fetchDataKeys()
    return { ok: true, data: keys }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


