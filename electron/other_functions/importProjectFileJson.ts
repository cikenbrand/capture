import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import { createProject, type NewProject } from '../db/createProject'
import { getAllProjects } from '../db/getAllProjects'
import { createTask } from '../db/createTask'
import { createDive } from '../db/createDive'
import { createNodes } from '../db/createNode'
import { editNode } from '../db/editNode'
import { editDive } from '../db/editDive'

type ImportedNode = {
  name: string
  remarks?: string
  status?: 'completed' | 'ongoing' | 'not-started'
  children?: ImportedNode[]
}

type ImportedProjectFile = {
  project: {
    name: string
    client: string
    contractor: string
    vessel: string
    location: string
    projectType: 'platform' | 'pipeline'
  }
  tasks?: Array<{ name: string; remarks?: string }>
  dives?: Array<{ name: string; remarks?: string; started?: boolean }>
  nodes?: ImportedNode[]
}

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

async function importProjectFileJson(jsonFilePath: string): Promise<string> {
  if (typeof jsonFilePath !== 'string' || !jsonFilePath.trim()) throw new Error('invalid file path')
  const raw = await fs.readFile(jsonFilePath, 'utf8')
  let parsed: ImportedProjectFile
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('invalid JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid JSON structure')

  const proj = parsed.project || ({} as any)
  const name = safeString(proj.name).trim()
  if (!name) throw new Error('project name is required')

  // Reject if a project with same name (case-insensitive) already exists
  const existing = await getAllProjects()
  const dup = existing.find(p => String(p.name).trim().toLowerCase() === name.toLowerCase())
  if (dup) throw new Error('A project with the same name already exists')

  const input: NewProject = {
    name,
    client: safeString(proj.client),
    contractor: safeString(proj.contractor),
    vessel: safeString(proj.vessel),
    location: safeString(proj.location),
    projectType: proj.projectType === 'pipeline' ? 'pipeline' : 'platform',
  }
  const createdProject = await createProject(input)
  const projectId = (createdProject as any)?._id?.toString?.() ?? String((createdProject as any)?._id)

  // Import tasks
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
  for (const t of tasks) {
    const taskName = safeString((t as any)?.name).trim()
    if (!taskName) continue
    try {
      await createTask({ projectId, name: taskName, remarks: safeString((t as any)?.remarks, undefined as any) })
    } catch { /* skip duplicates or errors */ }
  }

  // Import dives
  const dives = Array.isArray(parsed.dives) ? parsed.dives : []
  for (const d of dives) {
    const diveName = safeString((d as any)?.name).trim()
    if (!diveName) continue
    try {
      const created = await createDive({ projectId, name: diveName, remarks: safeString((d as any)?.remarks, undefined as any) })
      const id = (created as any)?._id?.toString?.() ?? String((created as any)?._id)
      const started = !!(d as any)?.started
      if (started) {
        try { await editDive(id, { started: true }) } catch {}
      }
    } catch { /* skip duplicates or errors */ }
  }

  // Import nodes tree recursively
  async function createNodeRecursive(node: ImportedNode, parentId?: string): Promise<string | null> {
    const nodeName = safeString(node?.name).trim()
    if (!nodeName) return null
    try {
      const created = await createNodes({ projectId, names: [nodeName], parentId, remarks: safeString(node?.remarks, undefined as any) })
      const first = Array.isArray(created) ? created[0] : null
      const nodeId = (first as any)?._id?.toString?.() ?? (first ? String((first as any)?._id) : null)
      if (nodeId) {
        const status = (node?.status === 'completed' || node?.status === 'ongoing' || node?.status === 'not-started') ? node.status : undefined
        if (status && status !== 'not-started') {
          try { await editNode(nodeId, { status }) } catch {}
        }
        const children = Array.isArray(node?.children) ? node.children : []
        for (const child of children) {
          await createNodeRecursive(child, nodeId)
        }
      }
      return nodeId
    } catch {
      return null
    }
  }

  const rootNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
  for (const rn of rootNodes) {
    await createNodeRecursive(rn)
  }

  return projectId
}

ipcMain.handle('project:import-project-file-json', async (_e, jsonFilePath: string) => {
  try {
    const projectId = await importProjectFileJson(jsonFilePath)
    return { ok: true, data: projectId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


