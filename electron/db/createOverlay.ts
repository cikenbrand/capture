import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { BrowserWindow, ipcMain } from 'electron'

export interface NewOverlay {
  name: string
}

export interface OverlayDoc {
  _id: ObjectId
  name: string
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

export async function createOverlay(input: NewOverlay): Promise<OverlayDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const overlays = db.collection<OverlayDoc>('overlays')

  const now = new Date()
  const trimmedName = input.name.trim()
  if (!trimmedName) throw new Error('Overlay name is required')

  // Prevent duplicate names (case-insensitive)
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existing = await overlays.findOne({ name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' } } as any)
  if (existing) throw new Error('An overlay with this name already exists')

  const doc = {
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
  }

  const result = await overlays.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

export async function closeMongo() {
  if (!cachedClient) return
  try {
    await cachedClient.close()
  } finally {
    cachedClient = null
  }
}

ipcMain.handle('db:createOverlay', async (_event, input: NewOverlay) => {
  try {
    const created = await createOverlay(input)
    const id = (created as any)?._id?.toString?.() ?? created
    try {
      const payload = { id, action: 'created', name: input?.name?.trim?.() || '' }
      for (const win of BrowserWindow.getAllWindows()) {
        try { win.webContents.send('overlays:changed', payload) } catch {}
      }
    } catch {}
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
