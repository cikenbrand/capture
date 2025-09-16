import { BrowserWindow, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import OBSWebSocket from "obs-websocket-js";
let splash = null;
function createSplashWindow(timeoutMs) {
  splash = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    transparent: false,
    backgroundColor: "#121212",
    alwaysOnTop: true,
    skipTaskbar: true
  });
  const publicRoot = process.env.VITE_PUBLIC || path.join(process.env.APP_ROOT || process.cwd(), "public");
  const splashFile = path.join(publicRoot, "htmls", "splashscreen.html");
  splash.loadFile(splashFile);
  splash.once("ready-to-show", () => splash == null ? void 0 : splash.show());
  splash.timeoutMs = timeoutMs;
  return splash;
}
function getRendererDist() {
  return process.env.APP_ROOT ? path.join(process.env.APP_ROOT, "dist") : path.join(__dirname, "..", "..", "dist");
}
function getDevUrl() {
  return process.env["VITE_DEV_SERVER_URL"] || "";
}
function createMainWindow() {
  const win2 = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: "#0f0f0f",
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), "electron-vite.svg"),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = getDevUrl();
  if (devUrl) {
    win2.loadURL(devUrl);
  } else {
    win2.loadFile(path.join(getRendererDist(), "index.html"));
  }
  return win2;
}
const OBS_EXECUTABLE_PATH = "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe".replace(/\\/g, "\\");
const OBS_WORKING_DIR = "C:\\Program Files\\obs-studio\\bin\\64bit".replace(/\\/g, "\\");
const OBS_WEBSOCKET_URL = "ws://127.0.0.1:4455";
const OBS_LAUNCH_PARAMS = ["--startvirtualcam", "--disable-shutdown-check"];
const SPLASHSCREEN_DURATION_MS = 5e3;
function openObs() {
  if (!fs.existsSync(OBS_EXECUTABLE_PATH)) {
    throw new Error(`OBS executable not found at: ${OBS_EXECUTABLE_PATH}`);
  }
  if (!fs.existsSync(OBS_WORKING_DIR)) {
    throw new Error(`Working directory does not exist: ${OBS_WORKING_DIR}`);
  }
  const child = spawn(OBS_EXECUTABLE_PATH, OBS_LAUNCH_PARAMS, {
    cwd: OBS_WORKING_DIR,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child.pid ?? -1;
}
let obsClient = null;
function getObsClient() {
  return obsClient;
}
async function connectToOBSWebsocket(timeoutMs = 4e3) {
  try {
    if (obsClient) {
      return true;
    }
    const client = new OBSWebSocket();
    const connectPromise = client.connect(OBS_WEBSOCKET_URL);
    const timeoutPromise = new Promise((_, reject) => {
      const t = setTimeout(() => {
        clearTimeout(t);
        reject(new Error("OBS connect timeout"));
      }, timeoutMs);
    });
    await Promise.race([connectPromise, timeoutPromise]);
    obsClient = client;
    return true;
  } catch {
    try {
      await (obsClient == null ? void 0 : obsClient.disconnect());
    } catch {
    }
    obsClient = null;
    return false;
  }
}
async function exitOBS() {
  const obs = getObsClient();
  if (!obs) return false;
  const force = true;
  const timeoutMs = 3e3;
  const requestData = {
    reason: `requested by ${path.basename(process.execPath)}`,
    support_url: "https://github.com/norihiro/obs-shutdown-plugin/issues",
    force,
    exit_timeout: 0
  };
  const vendorCall = obs.call("CallVendorRequest", {
    vendorName: "obs-shutdown-plugin",
    requestType: "shutdown",
    requestData
  });
  const timeout = new Promise((_, reject) => {
    const t = setTimeout(() => {
      clearTimeout(t);
      reject(new Error("exitOBS timed out"));
    }, timeoutMs);
  });
  try {
    await Promise.race([vendorCall, timeout]);
    return true;
  } catch (err) {
    return false;
  }
}
function checkIfOBSOpenOrNot() {
  try {
    if (process.platform === "win32") {
      const result = spawnSync("tasklist", [], { encoding: "utf8" });
      const output = (result.stdout || "").toLowerCase();
      if (!output) return false;
      return output.includes("obs64.exe") || output.includes("obs.exe");
    }
    if (process.platform === "darwin" || process.platform === "linux") {
      const result = spawnSync("ps", ["-A", "-o", "comm="], { encoding: "utf8" });
      const lines = (result.stdout || "").toLowerCase().split("\n");
      return lines.some((name) => name.includes("obs"));
    }
    return false;
  } catch (_err) {
    return false;
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let splashWin = null;
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function onceReadyToShow(bw) {
  return new Promise((resolve) => {
    if (bw.isDestroyed()) return resolve();
    if (bw.isVisible()) return resolve();
    bw.once("ready-to-show", () => resolve());
  });
}
async function createWindow() {
  splashWin = createSplashWindow(SPLASHSCREEN_DURATION_MS);
  const splashStart = Date.now();
  const updateSplash = async (text) => {
    try {
      if (splashWin && !splashWin.isDestroyed()) {
        await splashWin.webContents.executeJavaScript(
          `window.postMessage({ type: 'status', text: ${JSON.stringify(text)} }, '*')`
        );
      }
    } catch (_) {
    }
  };
  await updateSplash("Checking OBS…");
  let isObsRunning = false;
  try {
    isObsRunning = checkIfOBSOpenOrNot();
  } catch (_) {
    isObsRunning = false;
  }
  let launchedObs = false;
  if (!isObsRunning) {
    await updateSplash("Launching OBS…");
    try {
      openObs();
      launchedObs = true;
    } catch (err) {
      console.error("Failed to launch OBS:", err);
    }
  }
  if (launchedObs) {
    await updateSplash("Waiting for OBS to start…");
    while (true) {
      try {
        if (checkIfOBSOpenOrNot()) break;
      } catch (_) {
      }
      await delay(1e3);
    }
  }
  await updateSplash("Connecting to OBS WebSocket…");
  while (true) {
    const ok = await connectToOBSWebsocket(4e3);
    if (ok) break;
    await updateSplash("Failed to connect. Retrying…");
    await delay(1500);
  }
  win = createMainWindow();
  await onceReadyToShow(win);
  const elapsed = Date.now() - splashStart;
  const remaining = Math.max(0, SPLASHSCREEN_DURATION_MS - elapsed);
  if (remaining > 0) await delay(remaining);
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  splashWin = null;
  win == null ? void 0 : win.show();
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("Renderer crashed:", details);
  });
  win.on("unresponsive", () => {
    console.warn("Window unresponsive");
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
let isQuitting = false;
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  try {
    await exitOBS();
  } catch {
  }
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
