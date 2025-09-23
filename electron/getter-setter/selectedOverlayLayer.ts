import { ipcMain } from 'electron'

let selectedOverlayLayerId: string | null = null

export function setSelectedOverlayLayerId(id: string | null) {
  selectedOverlayLayerId = id ? id.trim() || null : null
}

export function getSelectedOverlayLayerId(): string | null {
  return selectedOverlayLayerId
}

ipcMain.handle('app:setSelectedOverlayLayerId', async (_event, id: string | null) => {
  try {
    setSelectedOverlayLayerId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedOverlayLayerId', async () => {
  try {
    return { ok: true, data: getSelectedOverlayLayerId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


