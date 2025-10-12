import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import fssync from 'node:fs'
import path from 'node:path'
import { getExportedProjectHierarchy } from '../db/getExportedProjectHierarchy'
import { getSelectedProjectDetails } from '../db/getSelectedProjectDetails'
import { getProjectLogs } from '../db/getProjectLogs'

type HierNode = { type: 'dive' | 'node' | 'session' | 'video' | 'image'; children?: Record<string, HierNode>; path?: string }

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function copyFileSafe(src: string, dest: string): Promise<boolean> {
  try {
    if (!src || typeof src !== 'string') return false
    await fs.access(src).catch(() => { throw new Error('missing') })
    await ensureDir(path.dirname(dest))
    try {
      await fs.copyFile(src, dest)
      return true
    } catch {
      // attempt to stream copy if large or cross-device
      await new Promise<void>((resolve, reject) => {
        const rd = fssync.createReadStream(src)
        rd.on('error', reject)
        const wr = fssync.createWriteStream(dest)
        wr.on('error', reject)
        wr.on('close', () => resolve())
        rd.pipe(wr)
      })
      return true
    }
  } catch {
    return false
  }
}

function sanitizeSegment(seg: string): string {
  const s = seg.replace(/[\\/:*?"<>|]/g, '_').trim()
  return s || 'untitled'
}

async function walkAndExport(root: Record<string, HierNode>, outRoot: string) {
  for (const diveName of Object.keys(root)) {
    const diveNode = root[diveName]
    const diveDir = path.join(outRoot, sanitizeSegment(diveName))
    await ensureDir(diveDir)
    const diveChildren = diveNode.children || {}
    for (const key of Object.keys(diveChildren)) {
      const node = diveChildren[key]
      await exportNode(node, path.join(diveDir, sanitizeSegment(key)))
    }
  }
}

async function exportNode(node: HierNode, targetDir: string) {
  if (node.type === 'video' || node.type === 'image') {
    // For leaf files, targetDir is actually the filename label's path; ensure parent exists
    await ensureDir(path.dirname(targetDir))
    let src = node.path || ''
    // If a clip path somehow lacks an extension, prefer .mkv
    if (src && !/\.[a-z0-9]{2,5}$/i.test(src)) src = `${src}.mkv`
    const base = path.basename(targetDir)
    const dest = path.join(path.dirname(targetDir), base)
    if (src) { await copyFileSafe(src, dest) }
    return
  }
  // Folder-like nodes
  await ensureDir(targetDir)
  const children = node.children || {}
  for (const key of Object.keys(children)) {
    const child = children[key]
    const childDir = path.join(targetDir, sanitizeSegment(key))
    await exportNode(child, childDir)
  }
}

function csvQuote(value: unknown): string {
  const s = value === null || value === undefined ? '' : (typeof value === 'string' ? value : JSON.stringify(value))
  const cleaned = String(s)
  const escaped = cleaned.replace(/"/g, '""')
  return `"${escaped}"`
}

async function writeProjectLogsCsv(projectId: string, outRoot: string) {
  const rows: string[] = []
  // header
  rows.push([
    'date', 'time', 'event', 'dive', 'task', 'components', 'fileName', 'anomaly', 'data', 'last edited',
  ].join(','))

  const limit = 1000
  let offset = 0
  // fetch in pages in case there are many logs
  while (true) {
    const page = await getProjectLogs(projectId, limit, offset)
    if (!Array.isArray(page) || page.length === 0) break
    for (const it of page) {
      rows.push([
        csvQuote(it.date),
        csvQuote(it.time),
        csvQuote(it.event),
        csvQuote(it.dive ?? ''),
        csvQuote(it.task ?? ''),
        csvQuote(it.components ?? ''),
        csvQuote(it.fileName ?? ''),
        csvQuote(it.anomaly ?? ''),
        csvQuote(it.data ?? ''),
        csvQuote(it.updatedAt),
      ].join(','))
    }
    if (page.length < limit) break
    offset += page.length
  }

  const csv = rows.join('\r\n') + '\r\n'
  await fs.writeFile(path.join(outRoot, 'project_logs.csv'), csv, 'utf8')
}

ipcMain.handle('project:export-entire', async (_e, projectId: string, destinationDir: string) => {
  try {
    if (typeof destinationDir !== 'string' || !destinationDir.trim()) return { ok: false, error: 'invalid destinationDir' }
    if (typeof projectId !== 'string' || !projectId.trim()) return { ok: false, error: 'invalid projectId' }

    // Load canonical data fresh from DB to avoid stale/partial renderer state
    const det = await getSelectedProjectDetails(projectId)
    const projectName = det?.name || 'Project'
    const hierarchy = await getExportedProjectHierarchy(projectId)

    const rootOut = path.join(destinationDir.trim(), sanitizeSegment(projectName || 'Project'))
    await ensureDir(rootOut)
    await walkAndExport(hierarchy || {}, rootOut)
    try { await writeProjectLogsCsv(projectId, rootOut) } catch {}
    return { ok: true, data: rootOut }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


