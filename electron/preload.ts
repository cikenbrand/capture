import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// Expose OBS helper API to renderer
contextBridge.exposeInMainWorld('obs', {
  async getCurrentScene(): Promise<string> {
    try {
      const name = await ipcRenderer.invoke('obs:get-current-scene')
      return typeof name === 'string' ? name : ''
    } catch {
      return ''
    }
  },
  onCurrentSceneChanged(listener: (sceneName: string) => void) {
    const channel = 'obs:current-scene-changed'
    const handler = (_e: unknown, sceneName: string) => {
      try { listener(sceneName) } catch {}
    }
    ipcRenderer.on(channel as any, handler as any)
    return () => {
      try { ipcRenderer.off(channel as any, handler as any) } catch {}
    }
  },
})

// Expose overlay settings
contextBridge.exposeInMainWorld('overlay', {
  wsPort: (() => {
    try {
      const val = ipcRenderer.sendSync('overlay:get-port-sync') as unknown
      const num = Number(val)
      return Number.isFinite(num) && num > 0 ? num : 3620
    } catch {
      return 3620
    }
  })(),
})