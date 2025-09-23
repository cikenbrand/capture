import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'
import type { OverlayComponentDoc, TextStyle, OverlayComponentType } from './createOverlayComponent'

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

type EditableFields = Partial<{
  overlayId: string
  name: string
  type: OverlayComponentType
  x: number
  y: number
  width: number
  height: number
  backgroundColor: string
  borderColor: string
  radius: number
  textStyle: TextStyle
  customText: string
  dateFormat: string
  twentyFourHour: boolean
  useUTC: boolean
  dataType: string
  nodeLevel: number
  imagePath: string
}>

function buildSetObject(updates: EditableFields): Record<string, any> {
  const $set: Record<string, any> = { updatedAt: new Date() }
  if (typeof updates.overlayId === 'string' && updates.overlayId.trim()) {
    $set.overlayId = new ObjectId(updates.overlayId)
  }
  if (typeof updates.name === 'string') $set.name = updates.name.trim()
  if (typeof updates.type === 'string') $set.type = updates.type
  if (typeof updates.x === 'number') $set.x = updates.x
  if (typeof updates.y === 'number') $set.y = updates.y
  if (typeof updates.width === 'number') $set.width = Math.max(1, updates.width)
  if (typeof updates.height === 'number') $set.height = Math.max(1, updates.height)
  if (typeof updates.backgroundColor === 'string') $set.backgroundColor = updates.backgroundColor
  if (typeof updates.borderColor === 'string') $set.borderColor = updates.borderColor
  if (typeof updates.radius === 'number') $set.radius = updates.radius
  if (typeof updates.textStyle === 'object' && updates.textStyle) $set.textStyle = updates.textStyle
  if (typeof updates.customText === 'string') $set.customText = updates.customText
  if (typeof updates.dateFormat === 'string') $set.dateFormat = updates.dateFormat
  if (typeof updates.twentyFourHour === 'boolean') $set.twentyFourHour = updates.twentyFourHour
  if (typeof updates.useUTC === 'boolean') $set.useUTC = updates.useUTC
  if (typeof updates.dataType === 'string') $set.dataType = updates.dataType
  if (typeof updates.nodeLevel === 'number') $set.nodeLevel = updates.nodeLevel
  if (typeof updates.imagePath === 'string') $set.imagePath = updates.imagePath
  return $set
}

export async function editOverlayComponents(ids: string[], updates: EditableFields): Promise<number> {
  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')

  const cleaned = Array.from(new Set((ids || []).map((s) => typeof s === 'string' ? s.trim() : '').filter(Boolean)))
  if (!cleaned.length) return 0

  const objectIds = cleaned.map((id) => new ObjectId(id))
  const $set = buildSetObject(updates)
  const res = await components.updateMany({ _id: { $in: objectIds } }, { $set })
  return res.modifiedCount ?? 0
}

ipcMain.handle('db:editOverlayComponent', async (_event, input: { ids: string[]; updates: EditableFields }) => {
  try {
    if (!input || !Array.isArray(input.ids) || !input.updates || typeof input.updates !== 'object') throw new Error('Invalid input')
    const modified = await editOverlayComponents(input.ids, input.updates)
    if (modified === 0) throw new Error('Overlay component(s) not found')
    return { ok: true, data: { ids: input.ids, modified } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


