import { ipcMain, BrowserWindow } from 'electron'

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
    try {
      const payload = id ?? null
      for (const w of BrowserWindow.getAllWindows()) {
        try { if (!w.isDestroyed()) w.webContents.send('app:selectedNodeChanged', payload) } catch {}
      }
    } catch {}
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


