import { ipcMain } from 'electron'
import { getObsClient } from './connectToOBSWebsocket'

export type ObsInputType = 'live-device' | 'rtmp' | 'webrtc'

async function listGroupChildren(groupName: string): Promise<any[]> {
  try {
    const obs = getObsClient() as any
    if (!obs) return []
    const res = await obs.call('GetGroupSceneItemList', { sceneName: groupName })
    return Array.isArray(res?.sceneItems) ? res.sceneItems : []
  } catch {
    return []
  }
}

function matches(name: string, type: ObsInputType, index: number): boolean {
  const n = name.toLowerCase().trim()
  const idx = String(index)
  if (type === 'live-device') return n.startsWith('video capture device') && n.includes(idx)
  if (type === 'rtmp') return n.startsWith('rtmp') && n.includes(idx)
  if (type === 'webrtc') return n.startsWith('webrtc') && n.includes(idx)
  return false
}

export async function setActiveInputForScene(sceneName: string, sourceIndex: number, inputType: ObsInputType): Promise<boolean> {
  const obs = getObsClient() as any
  if (!obs) return false

  const groupName = `source ${sourceIndex}`
  const items = await listGroupChildren(groupName)

  // Resolve ids for VCD/RTMP/WebRTC
  const findId = (t: ObsInputType): number | null => {
    const it = items.find((x: any) => matches(String(x?.sourceName ?? ''), t, sourceIndex))
    return it ? Number(it.sceneItemId) : null
  }
  const idLive = findId('live-device')
  const idRtmp = findId('rtmp')
  const idWeb = findId('webrtc')

  const enableId = async (id: number | null, on: boolean) => {
    if (id == null) return
    try { await obs.call('SetSceneItemEnabled', { sceneName: groupName, sceneItemId: id, sceneItemEnabled: on }) } catch {}
  }

  // Enable selected, disable others
  if (inputType === 'live-device') {
    await enableId(idLive, true)
    await enableId(idRtmp, false)
    await enableId(idWeb, false)
  } else if (inputType === 'rtmp') {
    await enableId(idRtmp, true)
    await enableId(idLive, false)
    await enableId(idWeb, false)
  } else if (inputType === 'webrtc') {
    await enableId(idWeb, true)
    await enableId(idLive, false)
    await enableId(idRtmp, false)
  }

  return true
}

// IPC
ipcMain.handle('obs:set-active-video-item', async (_e, sceneName: string, sourceIndex: number, inputType: ObsInputType) => {
  try {
    const ok = await setActiveInputForScene(sceneName, Number(sourceIndex), inputType)
    return ok === true
  } catch {
    return false
  }
})


