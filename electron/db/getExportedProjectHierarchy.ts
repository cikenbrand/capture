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
    clips?: string[]
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

type HierNode = { type: 'dive' | 'node' | 'session' | 'video' | 'image'; children?: Record<string, HierNode>; path?: string; sessionId?: string }

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

function imageLabelFromPath(p?: string | null): string | null {
    try {
        if (!p || typeof p !== 'string') return null
        const normalized = p.replace(/\\/g, '/').trim()
        if (!normalized) return null
        const base = normalized.split('/').pop() || ''
        if (!base) return null
        return base
    } catch {
        return null
    }
}

function withMkvIfNoExt(p?: string | null): string | null {
    try {
        if (!p || typeof p !== 'string') return null
        const trimmed = p.trim()
        if (!trimmed) return null
        const hasExt = /\.[a-z0-9]{2,5}$/i.test(trimmed)
        return hasExt ? trimmed : `${trimmed}.mkv`
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
		.find({ projectId: new ObjectId(projectId) }, { projection: { dive: 1, diveId: 1, nodesHierarchy: 1, createdAt: 1, preview: 1, ch1: 1, ch2: 1, ch3: 1, ch4: 1, clips: 1, snapshots: 1 } })
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
        // Attach the session id so downstream exporters can locate per-session data like event logs
        ;(sessionNode as any).sessionId = (s as any)._id?.toString?.() || String((s as any)._id)
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
                const p = withMkvIfNoExt(typeof pathStr === 'string' ? pathStr : null)
                videosNode.children[label] = p ? { type: 'video', path: p } : { type: 'video' }
            }
        }

        // Populate snapshots images under Snapshots
        const snapshotsNode = sessionNode.children['Snapshots']
        if (!snapshotsNode.children) snapshotsNode.children = {}
        const snapshotArrays: Array<string[] | undefined> = [
            (s as any)?.snapshots?.preview,
            (s as any)?.snapshots?.ch1,
            (s as any)?.snapshots?.ch2,
            (s as any)?.snapshots?.ch3,
            (s as any)?.snapshots?.ch4,
        ]
        for (const arr of snapshotArrays) {
            if (Array.isArray(arr)) {
                for (const imgPath of arr) {
                    const label = imageLabelFromPath(imgPath)
                    if (label && !snapshotsNode.children[label]) {
                        const p = typeof imgPath === 'string' ? imgPath.trim() : null
                        snapshotsNode.children[label] = p ? { type: 'image', path: p } : { type: 'image' }
                    }
                }
            }
        }

        // Add Clips folder under Videos if session has clips
        const clipPaths: string[] = Array.isArray((s as any).clips) ? ((s as any).clips as string[]) : []
        if (clipPaths.length > 0) {
            if (!videosNode.children['Clips']) videosNode.children['Clips'] = { type: 'node', children: {} }
            const clipsNode = videosNode.children['Clips']
            if (!clipsNode.children) clipsNode.children = {}
            for (const clipPath of clipPaths) {
                const label = fileLabelFromPath(clipPath)
                if (label && !clipsNode.children[label]) {
                    const p = (typeof clipPath === 'string') ? clipPath.trim() : null
                    clipsNode.children[label] = p ? { type: 'video', path: p } : { type: 'video' }
                }
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


