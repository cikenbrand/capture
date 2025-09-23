import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'

export type OverlayComponentType =
  | 'custom-text'
  | 'image'
  | 'date'
  | 'time'
  | 'dive'
  | 'data'
  | 'node'
  | 'task'

export type TextStyle = {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | 'normal' | 'bold'
  italic?: boolean
  underline?: boolean
  color?: string
  align?: 'left' | 'center' | 'right'
  letterSpacing?: number
  lineHeight?: number
  uppercase?: boolean
}

export interface NewOverlayComponent {
  overlayId: string
  name: string
  type: OverlayComponentType
  x: number
  y: number
  width: number
  height: number
  backgroundColor?: string
  borderColor?: string
  radius?: number
  // Text properties (for all non-image types)
  textStyle?: TextStyle
  // Specials
  customText?: string // for custom-text
  dateFormat?: string // for date (e.g., 'YYYY-MM-DD' | 'DD/MM/YYYY')
  twentyFourHour?: boolean // for time
  useUTC?: boolean // for time
  dataType?: string // for data
  nodeLevel?: number // for node
  imagePath?: string // for image
}

export interface OverlayComponentDoc extends Omit<NewOverlayComponent, 'overlayId'> {
  _id: ObjectId
  overlayId: ObjectId
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

export async function createOverlayComponent(input: NewOverlayComponent): Promise<OverlayComponentDoc> {
  // Basic validation
  if (!input?.overlayId) throw new Error('overlayId is required')
  if (!input?.name || !input.name.trim()) throw new Error('name is required')
  if (!input?.type) throw new Error('type is required')

  const overlayObjectId = new ObjectId(input.overlayId)

  // Provide sensible defaults for textStyle on text-capable types (all except image)
  const isTextCapable = input.type !== 'image'
  const defaultTextStyle: TextStyle | undefined = isTextCapable
    ? {
        fontFamily: 'Inter, ui-sans-serif, system-ui',
        fontSize: 16,
        fontWeight: 'normal',
        color: '#FFFFFF',
        align: 'left',
        letterSpacing: 0,
        lineHeight: 1.2,
        italic: false,
        underline: false,
        uppercase: false,
      }
    : undefined

  // Default specials
  let customFields: Partial<OverlayComponentDoc> = {}
  switch (input.type) {
    case 'custom-text':
      customFields.customText = input.customText ?? 'Text'
      break
    case 'date':
      customFields.dateFormat = input.dateFormat ?? 'YYYY-MM-DD' // alternative could be 'DD/MM/YYYY'
      break
    case 'time':
      customFields.twentyFourHour = input.twentyFourHour ?? true
      customFields.useUTC = input.useUTC ?? false
      break
    case 'data':
      customFields.dataType = input.dataType ?? 'string'
      break
    case 'node':
      customFields.nodeLevel = input.nodeLevel ?? 1
      break
    case 'image':
      customFields.imagePath = input.imagePath ?? ''
      break
    // dive, task: no special props
  }

  const doc: Omit<OverlayComponentDoc, '_id'> = {
    overlayId: overlayObjectId,
    name: input.name.trim(),
    type: input.type,
    x: Number(input.x) || 0,
    y: Number(input.y) || 0,
    width: Math.max(1, Number(input.width) || 100),
    height: Math.max(1, Number(input.height) || 40),
    backgroundColor: input.backgroundColor ?? 'transparent',
    borderColor: input.borderColor ?? 'transparent',
    radius: typeof input.radius === 'number' ? input.radius : 0,
    textStyle: isTextCapable ? { ...defaultTextStyle, ...(input.textStyle ?? {}) } : undefined,
    ...customFields,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const client = await getClient()
  const db = client.db('capture')
  const components = db.collection<OverlayComponentDoc>('overlay_components')
  const result = await components.insertOne(doc as any)
  return { _id: result.insertedId, ...(doc as any) }
}

ipcMain.handle('db:createOverlayComponent', async (_event, input: NewOverlayComponent) => {
  try {
    const created = await createOverlayComponent(input)
    const id = (created as any)?._id?.toString?.() ?? created
    return { ok: true, data: id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


