import { ipcMain } from "electron"

let selectedProjectId: string | null = null

export function setSelectedProjectId(id: string | null) {
  selectedProjectId = id ? id.trim() || null : null
}

export function getSelectedProjectId(): string | null {
  return selectedProjectId
}

ipcMain.handle('app:setSelectedProjectId', async (_event, id: string | null) => {
  try {
    setSelectedProjectId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})
