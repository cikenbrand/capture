import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import { getActiveSessionId } from '../getter-setter/activeSession'

export interface EventLogRow {
  _id: ObjectId
  sessionId: ObjectId
  eventName: string
  eventCode: string
  startTime: string
  endTime: string
  createdAt: Date
  updatedAt: Date
}

let cachedClient: MongoClient | null = null
async function getClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  })
  await client.connect()
  cachedClient = client
  return client
}

export async function getEventLogsForActiveSession(): Promise<EventLogRow[]> {
  const sessionId = getActiveSessionId()
  if (!sessionId) return []
  const client = await getClient()
  const db = client.db('capture')
  const col = db.collection<EventLogRow>('event_logs')
  const rows = await col
    .find({ sessionId: new ObjectId(String(sessionId)) })
    .sort({ createdAt: 1 })
    .toArray()
  // Normalize _id to plain string for renderer (avoid structured clone of ObjectId)
  return rows.map((r: any) => ({
    ...r,
    _id: typeof r._id?.toHexString === 'function' ? r._id.toHexString() : String(r._id),
  }))
}

export async function getEventLogsForSession(sessionId: string): Promise<EventLogRow[]> {
  if (!sessionId || typeof sessionId !== 'string') return []
  const client = await getClient()
  const db = client.db('capture')
  const col = db.collection<EventLogRow>('event_logs')
  const rows = await col
    .find({ sessionId: new ObjectId(String(sessionId)) })
    .sort({ createdAt: 1 })
    .toArray()
  return rows.map((r: any) => ({
    ...r,
    _id: typeof r._id?.toHexString === 'function' ? r._id.toHexString() : String(r._id),
  }))
}

ipcMain.handle('db:getEventLogsForActiveSession', async () => {
  try {
    const rows = await getEventLogsForActiveSession()
    return { ok: true, data: rows }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('db:getEventLogsForSession', async (_e, sessionId: string) => {
  try {
    const rows = await getEventLogsForSession(sessionId)
    return { ok: true, data: rows }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


