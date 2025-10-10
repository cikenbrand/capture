import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { ipcMain } from 'electron'
import { MONGODB_URI } from '../settings'

type SessionRow = {
	_id: ObjectId
	projectId: ObjectId
	diveId: ObjectId
	dive?: { id: ObjectId; name: string }
	nodesHierarchy?: { id: ObjectId; name: string; children?: any }
	createdAt: Date
    preview?: string
    ch1?: string
    ch2?: string
    ch3?: string
    ch4?: string
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

function formatSessionCode(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	const dd = pad(date.getDate())
	const mm = pad(date.getMonth() + 1)
	const yy = String(date.getFullYear()).slice(-2)
	const hh = pad(date.getHours())
	const min = pad(date.getMinutes())
	const ss = pad(date.getSeconds())
	return `${dd}${mm}${yy}${hh}${min}${ss}`
}

function extractNodePathNames(root?: { name: string; children?: any }): string[] {
	const names: string[] = []
	let cur: any = root
	while (cur && typeof cur === 'object') {
		if (cur.name) names.push(String(cur.name))
		cur = cur.children
	}
	return names
}

type HierNode = { type: 'dive' | 'node' | 'session' | 'video'; children?: Record<string, HierNode> }

function fileLabelFromPath(p?: string | null): string | null {
    try {
        if (!p || typeof p !== 'string') return null
        const normalized = p.replace(/\\/g, '/').trim()
        if (!normalized) return null
        const base = normalized.split('/').pop() || ''
        if (!base) return null
        return base.toLowerCase().endsWith('.mkv') ? base : `${base}.mkv`
    } catch {
        return null
    }
}

export async function getExportedProjectHierarchy(projectId: string) {
	const client = await getClient()
	const db = client.db('capture')

	const dives = await db.collection('dives')
		.find({ projectId: new ObjectId(projectId) }, { projection: { name: 1 } })
		.toArray()
	const diveIdToName = new Map<string, string>()
	for (const d of dives) {
		diveIdToName.set((d as any)._id.toString(), String((d as any).name || ''))
	}

    const sessions = await db.collection<SessionRow>('sessions')
		.find({ projectId: new ObjectId(projectId) }, { projection: { dive: 1, diveId: 1, nodesHierarchy: 1, createdAt: 1, preview: 1, ch1: 1, ch2: 1, ch3: 1, ch4: 1 } })
		.sort({ createdAt: 1 })
		.toArray()

    const result: Record<string, HierNode> = {}

	for (const s of sessions) {
		const diveName = (s.dive?.name && s.dive.name.trim())
			? s.dive.name.trim()
			: (diveIdToName.get(s.diveId.toString()) || `Dive ${s.diveId.toString().slice(-4)}`)
        const nodeNames = extractNodePathNames(s.nodesHierarchy)
		const sessionKey = formatSessionCode(new Date(s.createdAt))

        // Walk/create nested objects: Dive -> Node1 -> Node2 -> ... -> SessionKey
        if (!result[diveName]) result[diveName] = { type: 'dive', children: {} }
        let cursor = result[diveName]
        if (!cursor.children) cursor.children = {}
        // Build node chain, create intermediate nodes as needed
        for (const n of nodeNames) {
            if (!cursor.children[n]) cursor.children[n] = { type: 'node', children: {} }
            cursor = cursor.children[n]
            if (!cursor.children) cursor.children = {}
        }
        // Store session under the deepest node (or directly under dive if no nodes)
        if (!cursor.children[sessionKey]) cursor.children[sessionKey] = { type: 'session', children: {} }
        const sessionNode = cursor.children[sessionKey]
        if (!sessionNode.children) sessionNode.children = {}
        // Add Videos and Snapshots groups
        if (!sessionNode.children['Videos']) sessionNode.children['Videos'] = { type: 'node', children: {} }
        if (!sessionNode.children['Snapshots']) sessionNode.children['Snapshots'] = { type: 'node', children: {} }
        const videosNode = sessionNode.children['Videos']
        if (!videosNode.children) videosNode.children = {}
        // Add only available video items with filename labels (.mkv)
        const entries: Array<string | undefined> = [s.preview, s.ch1, s.ch2, s.ch3, s.ch4]
        for (const pathStr of entries) {
            const label = fileLabelFromPath(pathStr)
            if (label && !videosNode.children[label]) {
                videosNode.children[label] = { type: 'video' }
            }
        }
	}

	return result
}

ipcMain.handle('db:getExportedProjectHierarchy', async (_e, projectId: string) => {
	try {
		if (!projectId || typeof projectId !== 'string') return { ok: false, error: 'projectId is required' }
		const data = await getExportedProjectHierarchy(projectId)
		return { ok: true, data }
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return { ok: false, error: message }
	}
})


