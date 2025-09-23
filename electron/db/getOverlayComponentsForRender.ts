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

export async function getOverlayComponentsForRender(overlayId: string) {
  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')
  const filter = { overlayId: new ObjectId(overlayId) }
  const projection = {
    _id: 1,
    name: 1,
    type: 1,
    x: 1,
    y: 1,
    width: 1,
    height: 1,
    backgroundColor: 1,
    borderColor: 1,
    radius: 1,
    textStyle: 1,
    customText: 1,
    dateFormat: 1,
    twentyFourHour: 1,
    useUTC: 1,
    dataType: 1,
    nodeLevel: 1,
    imagePath: 1,
    createdAt: 1,
    updatedAt: 1,
  } as const
  const cursor = components.find(filter, { projection }).sort({ createdAt: 1 })
  const list = await cursor.toArray()
  return list
}

ipcMain.handle('db:getOverlayComponentsForRender', async (_event, input: { overlayId: string }) => {
  try {
    if (!input?.overlayId) throw new Error('overlayId is required')
    const items = await getOverlayComponentsForRender(input.overlayId)
    const plain = items.map((i) => ({
      _id: i._id.toString(),
      name: i.name,
      type: i.type,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      backgroundColor: i.backgroundColor,
      borderColor: i.borderColor,
      radius: i.radius,
      textStyle: i.textStyle,
      customText: (i as any).customText,
      dateFormat: (i as any).dateFormat,
      twentyFourHour: (i as any).twentyFourHour,
      useUTC: (i as any).useUTC,
      dataType: (i as any).dataType,
      nodeLevel: (i as any).nodeLevel,
      imagePath: (i as any).imagePath,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }))
    return { ok: true, data: plain }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


