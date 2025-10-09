import { BrowserWindow, ipcMain } from 'electron'

export type RecordingState = {
  isRecordingStarted: boolean
  isRecordingPaused: boolean
  isRecordingStopped: boolean
  isClipRecordingStarted: boolean
}

let recordingState: RecordingState = {
  isRecordingStarted: false,
  isRecordingPaused: false,
  isRecordingStopped: false,
  isClipRecordingStarted: false,
}

export function getRecordingState(): RecordingState {
  return recordingState
}

export function updateRecordingState(patch: Partial<RecordingState>) {
  recordingState = { ...recordingState, ...patch }
}

ipcMain.handle('recording:getState', async () => {
  try {
    return { ok: true, data: getRecordingState() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})

ipcMain.handle('recording:updateState', async (_e, patch: Partial<RecordingState>) => {
  try {
    updateRecordingState(patch || {})
    try {
      // Broadcast to all renderer windows so every window updates immediately
      for (const win of BrowserWindow.getAllWindows()) {
        try { win.webContents.send('recordingStateChanged') } catch {}
      }
    } catch {}
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
})


