import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'

export interface SessionSnapshotsInput {
  preview?: string[]
  ch1?: string[]
  ch2?: string[]
  ch3?: string[]
  ch4?: string[]
  clips?: string[]
}

export interface SessionWithSnapshotsDoc {
  _id: ObjectId
  projectId: ObjectId
  diveId: ObjectId
  taskId: ObjectId
  preview?: string
  ch1?: string
  ch2?: string
  ch3?: string
  ch4?: string
  clips?: string[]
  snapshots?: {
    preview?: string[]
    ch1?: string[]
    ch2?: string[]
    ch3?: string[]
    ch4?: string[]
  }
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

function cleanArray(input?: string[]): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out = input
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
  return out.length > 0 ? out : undefined
}

export async function editSession(sessionId: string, snapshots: SessionSnapshotsInput): Promise<SessionWithSnapshotsDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const sessions = db.collection<SessionWithSnapshotsDoc>('sessions')

  const _id = new ObjectId(sessionId)

  const toPush: Record<string, { $each: string[] }> = {}
  const preview = cleanArray(snapshots.preview)
  const ch1 = cleanArray(snapshots.ch1)
  const ch2 = cleanArray(snapshots.ch2)
  const ch3 = cleanArray(snapshots.ch3)
  const ch4 = cleanArray(snapshots.ch4)
  const clips = cleanArray(snapshots.clips)

  if (preview) toPush['snapshots.preview'] = { $each: preview }
  if (ch1) toPush['snapshots.ch1'] = { $each: ch1 }
  if (ch2) toPush['snapshots.ch2'] = { $each: ch2 }
  if (ch3) toPush['snapshots.ch3'] = { $each: ch3 }
  if (ch4) toPush['snapshots.ch4'] = { $each: ch4 }
  if (clips) toPush['clips'] = { $each: clips }

  if (Object.keys(toPush).length === 0) {
    throw new Error('No paths provided to append')
  }

  const updated = await sessions.findOneAndUpdate(
    { _id },
    {
      ...(Object.keys(toPush).length ? { $push: toPush } : {}),
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) throw new Error('Session not found')
  return updated
}

