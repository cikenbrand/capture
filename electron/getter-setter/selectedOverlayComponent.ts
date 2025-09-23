import { ipcMain } from 'electron'

let selectedOverlayComponentId: string | null = null

export function setSelectedOverlayComponentId(id: string | null) {
  selectedOverlayComponentId = id ? id.trim() || null : null
}

export function getSelectedOverlayComponentId(): string | null {
  return selectedOverlayComponentId
}

ipcMain.handle('app:setSelectedOverlayComponentId', async (_event, id: string | null) => {
  try {
    setSelectedOverlayComponentId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedOverlayComponentId', async () => {
  try {
    return { ok: true, data: getSelectedOverlayComponentId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


