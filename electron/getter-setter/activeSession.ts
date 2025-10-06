import { ipcMain } from 'electron'

let activeSessionId: string | null = null

export function setActiveSessionId(id: string | null) {
  activeSessionId = id ? id.trim() || null : null
}

export function getActiveSessionId(): string | null {
  return activeSessionId
}

ipcMain.handle('app:setActiveSessionId', async (_event, id: string | null) => {
  try {
    setActiveSessionId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getActiveSessionId', async () => {
  try {
    return { ok: true, data: getActiveSessionId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


