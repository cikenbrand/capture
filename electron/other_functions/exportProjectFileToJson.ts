import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getSelectedProjectId } from '../getter-setter/selectedProject'
import { getSelectedProjectDetails } from '../db/getSelectedProjectDetails'
import { getAllTasks } from '../db/getAllTasks'
import { getAllDives } from '../db/getAllDives'
import { getAllNodes } from '../db/getAllNodes'

function sanitizeSegment(seg: string): string {
  const s = seg.replace(/[\\/:*?"<>|]/g, '_').trim()
  return s || 'untitled'
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function mapTask(doc: any) {
  return {
    _id: (doc?._id as any)?.toString?.() ?? String(doc?._id ?? ''),
    projectId: (doc?.projectId as any)?.toString?.() ?? String(doc?.projectId ?? ''),
    name: String(doc?.name ?? ''),
    remarks: typeof doc?.remarks === 'string' ? doc.remarks : undefined,
    createdAt: doc?.createdAt ?? null,
    updatedAt: doc?.updatedAt ?? null,
  }
}

function mapDive(doc: any) {
  return {
    _id: (doc?._id as any)?.toString?.() ?? String(doc?._id ?? ''),
    projectId: (doc?.projectId as any)?.toString?.() ?? String(doc?.projectId ?? ''),
    name: String(doc?.name ?? ''),
    remarks: typeof doc?.remarks === 'string' ? doc.remarks : undefined,
    started: !!doc?.started,
    createdAt: doc?.createdAt ?? null,
    updatedAt: doc?.updatedAt ?? null,
  }
}

function mapNodeTree(n: any): any {
  return {
    _id: (n?._id as any)?.toString?.() ?? String(n?._id ?? ''),
    projectId: (n?.projectId as any)?.toString?.() ?? String(n?.projectId ?? ''),
    parentId: n?.parentId ? ((n.parentId as any)?.toString?.() ?? String(n.parentId)) : null,
    name: String(n?.name ?? ''),
    status: (n as any)?.status ?? 'not-started',
    remarks: typeof n?.remarks === 'string' ? n.remarks : undefined,
    level: typeof n?.level === 'number' ? n.level : 0,
    createdAt: n?.createdAt ?? null,
    updatedAt: n?.updatedAt ?? null,
    children: Array.isArray(n?.children) ? n.children.map(mapNodeTree) : [],
  }
}

async function exportProjectFileToJson(destinationDir: string) {
  if (typeof destinationDir !== 'string' || !destinationDir.trim()) throw new Error('invalid destinationDir')
  const projectId = getSelectedProjectId()
  if (!projectId) throw new Error('no selected project')

  const projectDoc = await getSelectedProjectDetails(projectId)
  if (!projectDoc) throw new Error('selected project not found')

  const tasks = await getAllTasks(projectId)
  const dives = await getAllDives(projectId)
  const nodeRoots = await getAllNodes(projectId)

  const projectPlain = {
    _id: (projectDoc._id as any)?.toString?.() ?? String(projectDoc._id),
    name: projectDoc.name,
    client: projectDoc.client,
    contractor: projectDoc.contractor,
    vessel: projectDoc.vessel,
    location: projectDoc.location,
    projectType: projectDoc.projectType,
    lastSelectedDiveId: projectDoc.lastSelectedDiveId ?? null,
    lastSelectedTaskId: projectDoc.lastSelectedTaskId ?? null,
    lastSelectedNodeId: projectDoc.lastSelectedNodeId ?? null,
    lastSelectedOverlayCh1Id: projectDoc.lastSelectedOverlayCh1Id ?? null,
    lastSelectedOverlayCh2Id: projectDoc.lastSelectedOverlayCh2Id ?? null,
    lastSelectedOverlayCh3Id: projectDoc.lastSelectedOverlayCh3Id ?? null,
    lastSelectedOverlayCh4Id: projectDoc.lastSelectedOverlayCh4Id ?? null,
    createdAt: projectDoc.createdAt,
    updatedAt: projectDoc.updatedAt,
  }

  const jsonObj = {
    project: projectPlain,
    tasks: Array.isArray(tasks) ? tasks.map(mapTask) : [],
    dives: Array.isArray(dives) ? dives.map(mapDive) : [],
    nodes: Array.isArray(nodeRoots) ? nodeRoots.map(mapNodeTree) : [],
  }

  const safeName = sanitizeSegment(projectDoc.name || 'Project')
  const outPath = path.join(destinationDir.trim(), `${safeName}.json`)
  await ensureDir(path.dirname(outPath))
  const json = JSON.stringify(jsonObj, null, 2)
  await fs.writeFile(outPath, json, 'utf8')
  return outPath
}

ipcMain.handle('project:export-project-file', async (_e, destinationDir: string) => {
  try {
    const outPath = await exportProjectFileToJson(destinationDir)
    return { ok: true, data: outPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


