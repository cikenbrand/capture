import { ipcMain } from 'electron'

let selectedNodeId: string | null = null

export function setSelectedNodeId(id: string | null) {
  selectedNodeId = id ? id.trim() || null : null
}

export function getSelectedNodeId(): string | null {
  return selectedNodeId
}

ipcMain.handle('app:setSelectedNodeId', async (_event, id: string | null) => {
  try {
    setSelectedNodeId(id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('app:getSelectedNodeId', async () => {
  try {
    return { ok: true, data: getSelectedNodeId() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


