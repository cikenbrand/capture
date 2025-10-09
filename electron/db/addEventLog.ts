import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import { getSerialDeviceState } from '../getter-setter/serialDeviceState'
import { getActiveSessionId } from '../getter-setter/activeSession'

export interface NewEventLogInput {
  eventName: string
  eventCode: string
  startTime: string | number
  endTime: string | number
  data?: unknown
}

export interface EventLogDoc {
  _id: ObjectId
  sessionId: ObjectId
  eventName: string
  eventCode: string
  startTime: string // HH:mm:ss
  endTime: string // HH:mm:ss
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

function pad2(n: number): string { return String(n).padStart(2, '0') }
function formatHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hh = pad2(Math.floor(totalSeconds / 3600))
  const mm = pad2(Math.floor((totalSeconds % 3600) / 60))
  const ss = pad2(totalSeconds % 60)
  return `${hh}:${mm}:${ss}`
}
function coerceTime(val: string | number): string {
  if (typeof val === 'number' && Number.isFinite(val)) return formatHMS(val)
  const s = String(val ?? '').trim()
  return s
}

export async function addEventLog(input: NewEventLogInput): Promise<EventLogDoc> {
  const sessionId = getActiveSessionId()
  if (!sessionId) throw new Error('No active session id')

  const client = await getClient()
  const db = client.db('capture')
  const col = db.collection<EventLogDoc>('event_logs')

  const now = new Date()
  const doc: Omit<EventLogDoc, '_id'> = {
    sessionId: new ObjectId(String(sessionId)),
    eventName: String(input.eventName || '').trim(),
    eventCode: String(input.eventCode || '').trim(),
    startTime: coerceTime(input.startTime),
    endTime: coerceTime(input.endTime),
    ...(typeof input.data !== 'undefined' ? { data: input.data } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await col.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

ipcMain.handle('db:addEventLog', async (_event, input: NewEventLogInput) => {
  try {
    const created = await addEventLog(input)
    const id = (created as any)?._id
    const plainId = typeof id?.toHexString === 'function' ? id.toHexString() : String(id)
    return { ok: true, data: plainId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


