import { BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type ImportInput = {
  /** Absolute path to the overlay JSON file */
  sourcePath: string
  /** Optional override name for the new overlay */
  nameOverride?: string
}

function isJsonFile(p: string): boolean {
  return path.extname(p).toLowerCase() === '.json'
}

async function createOverlaySafe(name: string): Promise<string> {
  // Try the given name; on duplicate, append suffix with counter
  let base = name.trim() || 'Imported Overlay'
  let attempt = 0
  while (true) {
    const candidate = attempt === 0 ? base : `${base} (${attempt + 1})`
    const res = await (global as any).ipcMain?.handle // placeholder to silence type, not used
    try {
      const out = await (global as any).electronIpcInvoke?.('db:createOverlay', { name: candidate })
      if (out?.ok && out.data) return String(out.data)
      // Fallback: direct invoke via ipcRenderer is not available in main; call function via IPC handler
    } catch {}
    // Fallback to direct call of handler through ipcMain is not possible; use renderer-safe path:
    // We'll use a local function to call createOverlay handler by sending an event-like call
    try {
      const { createOverlay } = await import('./createOverlay')
      const created = await createOverlay({ name: candidate } as any)
      return String((created as any)?._id?.toString?.() || created)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/already exists/i.test(message)) {
        attempt += 1
        continue
      }
      throw err
    }
  }
}

ipcMain.handle('db:importOverlay', async (_event, input: ImportInput) => {
  try {
    const sourcePath = String(input?.sourcePath || '').trim()
    if (!sourcePath || !isJsonFile(sourcePath)) throw new Error('sourcePath must be a .json file')
    const raw = fs.readFileSync(sourcePath, 'utf8')
    const parsed = JSON.parse(raw)
    const overlay = parsed?.overlay
    const items = Array.isArray(parsed?.components) ? parsed.components : []
    const nameRaw = String(input?.nameOverride || (overlay?.name || 'Imported Overlay'))

    // Create overlay (avoid name collisions)
    let overlayId: string
    try {
      const { createOverlay } = await import('./createOverlay')
      const created = await createOverlay({ name: nameRaw } as any)
      overlayId = String((created as any)?._id?.toString?.() || created)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/already exists/i.test(message)) {
        // try with suffix
        overlayId = await createOverlaySafe(nameRaw)
      } else {
        throw err
      }
    }

    // Create components
    const { createOverlayComponent } = await import('./createOverlayComponent')
    for (const c of items) {
      try {
        await createOverlayComponent({
          overlayId,
          type: c.type,
          name: undefined as any, // let the DB assign default names (type-#)
          x: Number(c.x) || 0,
          y: Number(c.y) || 0,
          width: Math.max(1, Number(c.width) || 1),
          height: Math.max(1, Number(c.height) || 1),
          backgroundColor: typeof c.backgroundColor === 'string' ? c.backgroundColor : 'transparent',
          borderColor: typeof c.borderColor === 'string' ? c.borderColor : 'transparent',
          radius: typeof c.radius === 'number' ? c.radius : 0,
          textStyle: typeof c.textStyle === 'object' ? c.textStyle : undefined,
          customText: typeof c.customText === 'string' ? c.customText : undefined,
          dateFormat: typeof c.dateFormat === 'string' ? c.dateFormat : undefined,
          twentyFourHour: typeof c.twentyFourHour === 'boolean' ? c.twentyFourHour : undefined,
          useUTC: typeof c.useUTC === 'boolean' ? c.useUTC : undefined,
          dataType: typeof c.dataType === 'string' ? c.dataType : undefined,
          nodeLevel: typeof c.nodeLevel === 'number' ? c.nodeLevel : undefined,
          imagePath: typeof c.imagePath === 'string' ? c.imagePath : undefined, // likely blank from export
          opacity: typeof c.opacity === 'number' ? c.opacity : undefined,
          projectDetail: typeof c.projectDetail === 'string' ? c.projectDetail : undefined,
        } as any)
      } catch {}
    }

    // Notify all renderer windows to refresh overlay lists
    try {
      const payload = { id: overlayId, action: 'created', name: nameRaw }
      for (const win of BrowserWindow.getAllWindows()) {
        try { win.webContents.send('overlays:changed', payload) } catch {}
      }
    } catch {}

    return { ok: true, data: { overlayId } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

export {}


