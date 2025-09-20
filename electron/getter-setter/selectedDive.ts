import { ipcMain } from "electron"

let selectedDiveId: string | null = null

export function setSelectedDiveId(id: string | null) {
  selectedDiveId = id ? id.trim() || null : null
}

export function getSelectedDiveId(): string | null {
  return selectedDiveId
}

ipcMain.handle('app:setSelectedDiveId', async (_event, id: string | null) => {
  try {
    setSelectedDiveId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedDiveId', async () => {
  try {
    return { ok: true, data: getSelectedDiveId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


