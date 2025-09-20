import { ipcMain } from "electron"
let selectedTaskId: string | null = null

export function setSelectedTaskId(id: string | null) {
  selectedTaskId = id ? id.trim() || null : null
}

export function getSelectedTaskId(): string | null {
  return selectedTaskId
}

ipcMain.handle('app:setSelectedTaskId', async (_event, id: string | null) => {
  try {
    setSelectedTaskId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedTaskId', async () => {
  try {
    return { ok: true, data: getSelectedTaskId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})