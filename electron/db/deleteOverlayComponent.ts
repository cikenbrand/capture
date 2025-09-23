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

export async function deleteOverlayComponents(ids: string[]): Promise<number> {
  const cleanedIds = Array.from(new Set((ids || []).map((s) => typeof s === 'string' ? s.trim() : '').filter(Boolean)))
  if (!cleanedIds.length) return 0
  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')
  const objectIds = cleanedIds.map((id) => new ObjectId(id))
  const res = await components.deleteMany({ _id: { $in: objectIds } })
  return res.deletedCount ?? 0
}

ipcMain.handle('db:deleteOverlayComponent', async (_event, input: { ids: string[] }) => {
  try {
    if (!input || !Array.isArray(input.ids)) throw new Error('Invalid ids')
    const deleted = await deleteOverlayComponents(input.ids)
    return { ok: true, data: { ids: input.ids, deleted } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


