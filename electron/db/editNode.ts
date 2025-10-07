import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { MONGODB_URI } from '../settings'
import type { NodeDoc } from './createNode'
import { ipcMain } from 'electron'

export interface EditNodeInput {
  name?: string
  remarks?: string
  status?: 'completed' | 'ongoing' | 'not-started'
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

async function getDescendantIds(nodes: any, rootId: ObjectId): Promise<ObjectId[]> {
  const queue: ObjectId[] = [rootId]
  const all: ObjectId[] = []
  while (queue.length) {
    const current = queue.shift()!
    const children = await nodes.find({ parentId: current }).project({ _id: 1 }).toArray()
    for (const c of children) {
      const cid: ObjectId = c._id
      all.push(cid)
      queue.push(cid)
    }
  }
  return all
}

async function recomputeAncestors(nodes: any, startParentId: ObjectId | undefined, now: Date): Promise<void> {
  let parentId = startParentId
  while (parentId) {
    const children = await nodes.find({ parentId }).project({ status: 1 }).toArray()
    const total = children.length
    let nextStatus: 'completed' | 'ongoing' | 'not-started' = 'not-started'
    if (total > 0) {
      const completed = children.filter((c: any) => c.status === 'completed').length
      const started = children.filter((c: any) => c.status === 'completed' || c.status === 'ongoing').length
      if (completed === total) nextStatus = 'completed'
      else if (started > 0) nextStatus = 'ongoing'
      else nextStatus = 'not-started'
    }
    await nodes.updateOne({ _id: parentId }, { $set: { status: nextStatus, updatedAt: now } })
    const parent = await nodes.findOne({ _id: parentId }, { projection: { parentId: 1 } })
    parentId = parent?.parentId as ObjectId | undefined
  }
}

export async function editNode(nodeId: string, updates: EditNodeInput, options?: { cascade?: boolean }): Promise<NodeDoc> {
  const client = await getClient()
  const db = client.db('capture')
  const nodes = db.collection<NodeDoc>('nodes')

  const _id = new ObjectId(nodeId)

  const now = new Date()
  const set: Partial<NodeDoc> = { updatedAt: now }

  if (typeof updates.name === 'string') set.name = updates.name.trim()
  if (typeof updates.remarks === 'string') set.remarks = updates.remarks.trim()
  if (typeof updates.status === 'string') set.status = updates.status as any

  const updated = await nodes.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!updated) {
    throw new Error('Node not found')
  }

  // Cascade effects for completion
  try {
    // Handle cascades and ancestor recomputation for any status change
    if (updates.status === 'completed' && options?.cascade) {
      const descendants = await getDescendantIds(nodes, _id)
      if (descendants.length) {
        await nodes.updateMany({ _id: { $in: descendants } as any }, { $set: { status: 'completed', updatedAt: now } })
      }
    }
    const parent = await nodes.findOne({ _id }, { projection: { parentId: 1 } })
    const parentId = parent?.parentId as ObjectId | undefined
    if (parentId) {
      await recomputeAncestors(nodes, parentId, now)
    }
  } catch { /* ignore cascade errors */ }

  return updated
}

ipcMain.handle('db:editNode', async (_event, nodeId, updates, options) => {
  try {
    const updated = await editNode(nodeId, updates, options)
    return { ok: true, data: updated }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

