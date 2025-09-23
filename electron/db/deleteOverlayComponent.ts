import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import type { OverlayComponentDoc } from './createOverlayComponent'

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

export async function deleteOverlayComponent(id: string): Promise<boolean> {
  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')
  const _id = new ObjectId(id)
  const res = await components.deleteOne({ _id })
  return res.deletedCount === 1
}

ipcMain.handle('db:deleteOverlayComponent', async (_event, input: { id: string }) => {
  try {
    if (!input?.id) throw new Error('Invalid id')
    const ok = await deleteOverlayComponent(input.id)
    if (!ok) throw new Error('Overlay component not found')
    return { ok: true, data: input.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


