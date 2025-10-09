import { ipcMain } from 'electron'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export type EditEventLogInput = {
  eventName?: string | null
  eventCode?: string | null
  startTime?: string | number | null
  endTime?: string | number | null
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

function pad2(n: number): string { return String(n).padStart(2, '0') }
function formatHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hh = pad2(Math.floor(totalSeconds / 3600))
  const mm = pad2(Math.floor((totalSeconds % 3600) / 60))
  const ss = pad2(totalSeconds % 60)
  return `${hh}:${mm}:${ss}`
}
function coerceTime(val: string | number | null | undefined): string | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return formatHMS(val)
  if (typeof val === 'string') return val.trim()
  return undefined
}

export async function editEventLog(id: string, patch: EditEventLogInput): Promise<{ matched: number; modified: number }> {
  const client = await getClient()
  const db = client.db('capture')
  const col = db.collection('event_logs')

  const _id = new ObjectId(String(id))
  const $set: Record<string, any> = { updatedAt: new Date() }
  if (typeof patch.eventName !== 'undefined' && patch.eventName !== null) $set.eventName = String(patch.eventName).trim()
  if (typeof patch.eventCode !== 'undefined' && patch.eventCode !== null) $set.eventCode = String(patch.eventCode).trim()
  const st = coerceTime(patch.startTime)
  if (typeof st !== 'undefined') $set.startTime = st
  const et = coerceTime(patch.endTime)
  if (typeof et !== 'undefined') $set.endTime = et

  const res = await col.updateOne({ _id }, { $set })
  return { matched: res.matchedCount, modified: res.modifiedCount }
}

ipcMain.handle('db:editEventLog', async (_event, id: string, patch: EditEventLogInput) => {
  try {
    const r = await editEventLog(id, patch || {})
    return { ok: true, data: { matched: r.matched, modified: r.modified } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


