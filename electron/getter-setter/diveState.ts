import { ipcMain } from 'electron'

let startedDiveId: string | null = null

export function getStartedDiveId(): string | null {
  return startedDiveId
}

export function setDiveStarted(diveId: string | null, started: boolean) {
  if (started) {
    startedDiveId = diveId ? diveId.trim() || null : null
  } else {
    if (startedDiveId && diveId && startedDiveId === diveId.trim()) {
      startedDiveId = null
    } else if (!diveId) {
      // Explicitly clear if no id provided
      startedDiveId = null
    }
  }
}

ipcMain.handle('dive:getStartedDiveId', async () => {
  try {
    return { ok: true, data: getStartedDiveId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('dive:isStarted', async (_event, diveId: string | null) => {
  try {
    const id = typeof diveId === 'string' ? diveId.trim() || null : null
    return { ok: true, data: !!(id && startedDiveId === id) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('dive:setStarted', async (_event, diveId: string | null, started: boolean) => {
  try {
    setDiveStarted(typeof diveId === 'string' ? diveId : null, !!started)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


