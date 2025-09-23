import { ipcMain } from 'electron'

let selectedOverlayComponentIds: string[] = []

export function setSelectedOverlayComponentIds(ids: string[] | null) {
  if (!ids || !Array.isArray(ids)) {
    selectedOverlayComponentIds = []
    return
  }
  const cleaned = ids
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => !!s)
  selectedOverlayComponentIds = Array.from(new Set(cleaned))
}

export function getSelectedOverlayComponentIds(): string[] {
  return [...selectedOverlayComponentIds]
}

// New plural IPC
ipcMain.handle('app:setSelectedOverlayComponentIds', async (_event, ids: string[] | null) => {
  try {
    setSelectedOverlayComponentIds(ids)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedOverlayComponentIds', async () => {
  try {
    return { ok: true, data: getSelectedOverlayComponentIds() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


