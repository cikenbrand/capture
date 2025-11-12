import { BrowserWindow, ipcMain } from 'electron'

export type VideoInputType = 'live-device' | 'rtmp' | 'webrtc' | 'none'

type ChannelIndex = 1 | 2 | 3 | 4

type ChannelState = {
  inputType: VideoInputType
}

const defaultState: Record<ChannelIndex, ChannelState> = {
  1: { inputType: 'none' },
  2: { inputType: 'none' },
  3: { inputType: 'none' },
  4: { inputType: 'none' },
}

let state: Record<ChannelIndex, ChannelState> = { ...defaultState }

export function getVideoChannelState(): Record<ChannelIndex, ChannelState> {
  return { ...state }
}

export function setVideoChannelInputType(channel: ChannelIndex, inputType: VideoInputType) {
  state = { ...state, [channel]: { ...state[channel], inputType } }
  try {
    const all = BrowserWindow.getAllWindows()
    for (const win of all) {
      try { win.webContents.send('video:input-type-changed', { channel, inputType }) } catch {}
    }
  } catch {}
}

ipcMain.handle('video:get-channel-state', async () => {
  try { return { ok: true, data: getVideoChannelState() } } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' } }
})

ipcMain.handle('video:set-channel-input-type', async (_e, channel: number, inputType: VideoInputType) => {
  try {
    const ch = Math.max(1, Math.min(4, Number(channel || 0))) as ChannelIndex
    setVideoChannelInputType(ch, inputType)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
})


