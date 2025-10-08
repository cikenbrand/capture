import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface NewProjectLogInput {
  projectId: string
  event: string
  dive?: string | null
  task?: string | null
  components?: unknown
  fileName?: string | null
  anomaly?: string | null
  data?: unknown
}

export interface ProjectLogDoc {
  _id: ObjectId
  projectId: ObjectId
  // Human-readable date/time strings (local time)
  date: string // YYYY-MM-DD
  time: string // HH:mm:ss
  event: string
  dive?: string | null
  task?: string | null
  components?: unknown
  fileName?: string | null
  anomaly?: string | null
  data?: unknown
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

function pad2(n: number): string { return String(n).padStart(2, '0') }

export async function addProjectLog(input: NewProjectLogInput): Promise<ProjectLogDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const logs = db.collection<ProjectLogDoc>('project_logs')

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  const hh = pad2(now.getHours())
  const mi = pad2(now.getMinutes())
  const ss = pad2(now.getSeconds())

  const projectObjectId = new ObjectId(String(input.projectId).trim())
  const doc: Omit<ProjectLogDoc, '_id'> = {
    projectId: projectObjectId,
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}:${ss}`,
    event: String(input.event || '').trim(),
    ...(input.dive ? { dive: String(input.dive).trim() || null } : { dive: null }),
    ...(input.task ? { task: String(input.task).trim() || null } : { task: null }),
    ...(typeof input.components !== 'undefined' ? { components: input.components } : {}),
    ...(input.fileName ? { fileName: String(input.fileName).trim() || null } : { fileName: null }),
    ...(input.anomaly ? { anomaly: String(input.anomaly).trim() || null } : { anomaly: null }),
    ...(typeof input.data !== 'undefined' ? { data: input.data } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await logs.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

ipcMain.handle('db:addProjectLog', async (_event, input: NewProjectLogInput) => {
  try {
    const created = await addProjectLog(input)
    const id = (created as any)?._id?.toString?.() ?? created
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


