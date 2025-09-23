"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("obs", {
  async getCurrentScene() {
    try {
      const name = await electron.ipcRenderer.invoke("obs:get-current-scene");
      return typeof name === "string" ? name : "";
    } catch {
      return "";
    }
  },
  async setCurrentScene(sceneName) {
    try {
      if (typeof sceneName !== "string" || !sceneName.trim()) return false;
      const ok = await electron.ipcRenderer.invoke("obs:set-current-scene", sceneName);
      return ok === true;
    } catch {
      return false;
    }
  },
  // Alias for clarity in renderer code
  async setSelectedScene(sceneName) {
    return this.setCurrentScene(sceneName);
  },
  onCurrentSceneChanged(listener) {
    const channel = "obs:current-scene-changed";
    const handler = (_e, sceneName) => {
      try {
        listener(sceneName);
      } catch {
      }
    };
    electron.ipcRenderer.on(channel, handler);
    return () => {
      try {
        electron.ipcRenderer.off(channel, handler);
      } catch {
      }
    };
  }
});
electron.contextBridge.exposeInMainWorld("overlay", {
  wsPort: (() => {
    try {
      const val = electron.ipcRenderer.sendSync("overlay:get-port-sync");
      const num = Number(val);
      return Number.isFinite(num) && num > 0 ? num : 3620;
    } catch {
      return 3620;
    }
  })()
});
