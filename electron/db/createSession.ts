import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import { ipcMain } from 'electron'

export interface NewSession {
  projectId: string
  diveId: string
  taskId: string
  nodeId: string
  preview?: string
  ch1?: string
  ch2?: string
  ch3?: string
  ch4?: string
}

export interface SessionDoc {
  _id: ObjectId
  projectId: ObjectId
  diveId: ObjectId
  taskId: ObjectId
  // Denormalized references with names for convenience
  dive?: { id: ObjectId; name: string }
  task?: { id: ObjectId; name: string }
  nodesHierarchy?: { id: ObjectId; name: string; children?: { id: ObjectId; name: string; children?: any } }
  preview?: string
  ch1?: string
  ch2?: string
  ch3?: string
  ch4?: string
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

export async function createSession(input: NewSession): Promise<SessionDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const sessions = db.collection<SessionDoc>('sessions')

  const now = new Date()  

  const hasAnyVideo = [input.preview, input.ch1, input.ch2, input.ch3, input.ch4]
    .some(v => typeof v === 'string' && v.trim().length > 0)
  if (!hasAnyVideo) {
    throw new Error('At least one of preview/ch1/ch2/ch3/ch4 must be provided')
  }

  const nodeObjectId: ObjectId | null = typeof input.nodeId === 'string' && input.nodeId.trim()
    ? new ObjectId(input.nodeId.trim())
    : null

  // Fetch denormalized names
  const diveObjectId = new ObjectId(input.diveId)
  const taskObjectId = new ObjectId(input.taskId)
  const [diveDoc, taskDoc] = await Promise.all([
    db.collection('dives').findOne({ _id: diveObjectId }, { projection: { name: 1 } }),
    db.collection('tasks').findOne({ _id: taskObjectId }, { projection: { name: 1 } }),
  ])

  // Build node path (ancestor chain) for the first selected node id, ordered from root -> selected
  let nodesWithNames: { id: ObjectId; name: string }[] = []
  if (nodeObjectId) {
    const nodesCol = db.collection('nodes')
    const chain: { id: ObjectId; name: string }[] = []
    let currentId: ObjectId | null = nodeObjectId
    while (currentId) {
      const nd: any = await nodesCol.findOne({ _id: currentId }, { projection: { name: 1, parentId: 1 } })
      if (!nd) break
      chain.push({ id: currentId, name: String(nd.name || '') })
      const parentId: ObjectId | undefined = nd.parentId as any
      if (!parentId) break
      currentId = parentId
    }
    nodesWithNames = chain.reverse()
  }

  // Convert linear chain to nested hierarchy { id, name, children }
  let nodesHierarchy: { id: ObjectId; name: string; children?: any } | undefined = undefined
  if (nodesWithNames.length > 0) {
    for (let i = nodesWithNames.length - 1; i >= 0; i--) {
      const entry = nodesWithNames[i]
      if (!nodesHierarchy) {
        nodesHierarchy = { id: entry.id, name: entry.name }
      } else {
        nodesHierarchy = { id: nodesWithNames[i].id, name: nodesWithNames[i].name, children: nodesHierarchy }
      }
    }
  }

  const doc: Omit<SessionDoc, '_id'> = {
    projectId: new ObjectId(input.projectId),
    diveId: diveObjectId,
    taskId: taskObjectId,
    dive: { id: diveObjectId, name: String((diveDoc as any)?.name || '') },
    task: { id: taskObjectId, name: String((taskDoc as any)?.name || '') },
    ...(nodesHierarchy ? { nodesHierarchy } : {}),
    ...(input.preview && input.preview.trim() ? { preview: input.preview.trim() } : {}),
    ...(input.ch1 && input.ch1.trim() ? { ch1: input.ch1.trim() } : {}),
    ...(input.ch2 && input.ch2.trim() ? { ch2: input.ch2.trim() } : {}),
    ...(input.ch3 && input.ch3.trim() ? { ch3: input.ch3.trim() } : {}),
    ...(input.ch4 && input.ch4.trim() ? { ch4: input.ch4.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const result = await sessions.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

ipcMain.handle('db:createSession', async (_event, input: NewSession) => {
  try {
    const created = await createSession(input)
    const id = (created as any)?._id?.toString?.() ?? created
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
