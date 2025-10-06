import { BrowserWindow, ipcMain, app } from "electron";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import OBSWebSocket from "obs-websocket-js";
import http from "node:http";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import fsp from "node:fs/promises";
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
    title: "Deepstrim Capture",
    frame: false,
    backgroundColor: "#0f0f0f",
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), "dc.ico"),
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
function createOverlayEditorWindow() {
  const win2 = new BrowserWindow({
    width: 1e3,
    height: 700,
    show: true,
    frame: false,
    backgroundColor: "#0f0f0f",
    icon: path.join(process.env.VITE_PUBLIC || getRendererDist(), "dc.ico"),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT || path.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });
  const devUrl = getDevUrl();
  if (devUrl) {
    win2.loadURL(`${devUrl}?window=overlay-editor`);
  } else {
    win2.loadFile(path.join(getRendererDist(), "index.html"), { query: { window: "overlay-editor" } });
  }
  return win2;
}
const OBS_EXECUTABLE_PATH = "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe".replace(/\\/g, "\\");
const OBS_WORKING_DIR = "C:\\Program Files\\obs-studio\\bin\\64bit".replace(/\\/g, "\\");
const OBS_WEBSOCKET_URL = "ws://127.0.0.1:4455";
const OBS_LAUNCH_PARAMS = ["--startvirtualcam", "--disable-shutdown-check"];
path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "obs-studio",
  "basic",
  "profiles",
  "Default",
  "basic.ini"
);
const OVERLAY_WS_PORT = 3620;
const MONGODB_URI = "mongodb://localhost:27017/capture";
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
async function getCurrentSceneName() {
  try {
    const obs = getObsClient();
    if (!obs) return "";
    const res = await obs.call("GetCurrentProgramScene");
    const name = (res == null ? void 0 : res.currentProgramSceneName) ?? "";
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}
ipcMain.handle("obs:get-current-scene", async () => {
  try {
    const name = await getCurrentSceneName();
    return name;
  } catch {
    return "";
  }
});
async function setSelectedScene(sceneName) {
  try {
    const obs = getObsClient();
    if (!obs) return false;
    await obs.call("SetCurrentProgramScene", { sceneName });
    return true;
  } catch {
    return false;
  }
}
ipcMain.handle("obs:set-current-scene", async (_event, sceneName) => {
  try {
    if (typeof sceneName !== "string" || !sceneName.trim()) return false;
    return await setSelectedScene(sceneName);
  } catch {
    return false;
  }
});
let browserSourceProc = null;
let browserSourceInProcess = false;
let currentPort = null;
function resolveServerPath() {
  const appRoot = process.env.APP_ROOT || path.join(__dirname, "..", "..");
  const asarPath = path.join(appRoot, "drawing-service", "server.js");
  const unpackedPath = asarPath.replace(/\.asar(\\|\/)/, ".asar.unpacked$1");
  try {
    return require("fs").existsSync(unpackedPath) ? unpackedPath : asarPath;
  } catch {
    return asarPath;
  }
}
function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tryOnce = () => {
      try {
        const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 1e3 }, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              res.resume();
            } catch {
            }
            resolve(true);
          } else {
            try {
              res.resume();
            } catch {
            }
            if (Date.now() >= deadline) return resolve(false);
            setTimeout(tryOnce, 300);
          }
        });
        req.on("error", () => {
          if (Date.now() >= deadline) return resolve(false);
          setTimeout(tryOnce, 300);
        });
        req.on("timeout", () => {
          try {
            req.destroy();
          } catch {
          }
          if (Date.now() >= deadline) return resolve(false);
          setTimeout(tryOnce, 300);
        });
      } catch {
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(tryOnce, 300);
      }
    };
    tryOnce();
  });
}
async function startBrowserSourceService(port) {
  try {
    if (browserSourceProc || browserSourceInProcess) return true;
    const resolvedPort = Number(port || OVERLAY_WS_PORT || 3620) || 3620;
    const serverPath = resolveServerPath();
    let overlayImagesDir = "";
    try {
      overlayImagesDir = path.join(app.getPath("userData"), "overlay-images");
    } catch {
      overlayImagesDir = "";
    }
    process.env.OVERLAY_WS_PORT = String(resolvedPort);
    process.env.OVERLAY_IMAGES_DIR = overlayImagesDir;
    try {
      const url = pathToFileURL(serverPath).href;
      await import(url);
      browserSourceInProcess = true;
      currentPort = resolvedPort;
      const ok = await waitForHealth(resolvedPort, 5e3);
      if (!ok) {
        try {
          console.warn("[browser-source-service] did not become healthy in time");
        } catch {
        }
      }
      return true;
    } catch (impErr) {
      const exec = process.execPath;
      const args = [serverPath];
      browserSourceProc = spawn(exec, args, {
        cwd: path.dirname(serverPath),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", OVERLAY_WS_PORT: String(resolvedPort), OVERLAY_IMAGES_DIR: overlayImagesDir },
        stdio: "ignore",
        detached: false
      });
      browserSourceProc.on("exit", (code, signal) => {
        try {
          console.log(`[browser-source-service] exited code=${code} signal=${signal}`);
        } catch {
        }
        browserSourceProc = null;
        currentPort = null;
      });
      currentPort = resolvedPort;
      const ok = await waitForHealth(resolvedPort, 5e3);
      if (!ok) {
        try {
          console.warn("[browser-source-service] did not become healthy in time");
        } catch {
        }
      }
      return true;
    }
  } catch (err) {
    try {
      console.error("[browser-source-service] failed to start:", err);
    } catch {
    }
    return false;
  }
}
async function stopBrowserSourceService() {
  try {
    const p = browserSourceProc;
    browserSourceProc = null;
    currentPort = null;
    browserSourceInProcess = false;
    if (!p) return;
    try {
      p.kill();
    } catch {
    }
  } catch {
  }
}
let cachedClient$q = null;
async function getClient$q() {
  if (cachedClient$q) return cachedClient$q;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$q = client;
  return client;
}
async function createProject(input) {
  const client = await getClient$q();
  const db = client.db("capture");
  const projects = db.collection("projects");
  const now = /* @__PURE__ */ new Date();
  const doc = {
    name: input.name.trim(),
    client: input.client.trim(),
    contractor: input.contractor.trim(),
    vessel: input.vessel.trim(),
    location: input.location.trim(),
    projectType: input.projectType,
    // initialize with no last selected dive
    lastSelectedDiveId: null,
    // initialize with no last selected task
    lastSelectedTaskId: null,
    // initialize with no last selected node
    lastSelectedNodeId: null,
    // initialize with no last selected overlays per channel
    lastSelectedOverlayCh1Id: null,
    lastSelectedOverlayCh2Id: null,
    lastSelectedOverlayCh3Id: null,
    lastSelectedOverlayCh4Id: null,
    createdAt: now,
    updatedAt: now
  };
  const result = await projects.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createProject", async (_event, input) => {
  var _a, _b;
  try {
    const created = await createProject(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$p = null;
async function getClient$p() {
  if (cachedClient$p) return cachedClient$p;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$p = client;
  return client;
}
async function createOverlay(input) {
  const client = await getClient$p();
  const db = client.db("capture");
  const overlays = db.collection("overlays");
  const now = /* @__PURE__ */ new Date();
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Overlay name is required");
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await overlays.findOne({ name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" } });
  if (existing) throw new Error("An overlay with this name already exists");
  const doc = {
    name: trimmedName,
    createdAt: now,
    updatedAt: now
  };
  const result = await overlays.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createOverlay", async (_event, input) => {
  var _a, _b, _c, _d;
  try {
    const created = await createOverlay(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    try {
      const payload = { id, action: "created", name: ((_d = (_c = input == null ? void 0 : input.name) == null ? void 0 : _c.trim) == null ? void 0 : _d.call(_c)) || "" };
      for (const win2 of BrowserWindow.getAllWindows()) {
        try {
          win2.webContents.send("overlays:changed", payload);
        } catch {
        }
      }
    } catch {
    }
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$o = null;
async function getClient$o() {
  if (cachedClient$o) return cachedClient$o;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$o = client;
  return client;
}
async function getAllOverlay() {
  const client = await getClient$o();
  const db = client.db("capture");
  const overlays = db.collection("overlays");
  return overlays.find({}).sort({ createdAt: -1 }).toArray();
}
ipcMain.handle("db:getAllOverlay", async () => {
  try {
    const overlays = await getAllOverlay();
    const plain = overlays.map((o) => ({
      _id: o._id.toString(),
      name: o.name,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    }));
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$n = null;
async function getClient$n() {
  if (cachedClient$n) return cachedClient$n;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$n = client;
  return client;
}
async function createTask(input) {
  const client = await getClient$n();
  const db = client.db("capture");
  const tasks = db.collection("tasks");
  const now = /* @__PURE__ */ new Date();
  const remarks = typeof input.remarks === "string" ? input.remarks.trim() : void 0;
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Task name is required");
  }
  const existing = await tasks.findOne({
    projectId: new ObjectId(input.projectId),
    name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
  if (existing) {
    throw new Error("A task with this name already exists in this project");
  }
  const doc = {
    projectId: new ObjectId(input.projectId),
    name: trimmedName,
    ...remarks ? { remarks } : {},
    createdAt: now,
    updatedAt: now
  };
  const result = await tasks.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createTask", async (_event, input) => {
  var _a, _b;
  try {
    const created = await createTask(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$m = null;
async function getClient$m() {
  if (cachedClient$m) return cachedClient$m;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$m = client;
  return client;
}
async function getAllTasks(projectId) {
  const client = await getClient$m();
  const db = client.db("capture");
  const tasks = db.collection("tasks");
  return tasks.find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
}
ipcMain.handle("db:getAllTasks", async (_event, projectId) => {
  try {
    if (!projectId || typeof projectId !== "string") {
      return { ok: false, error: "projectId is required" };
    }
    const items = await getAllTasks(projectId);
    const plain = items.map((t) => {
      var _a, _b, _c, _d;
      return {
        _id: ((_b = (_a = t._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? t._id,
        projectId: ((_d = (_c = t.projectId) == null ? void 0 : _c.toString) == null ? void 0 : _d.call(_c)) ?? t.projectId,
        name: t.name,
        remarks: t.remarks,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$l = null;
async function getClient$l() {
  if (cachedClient$l) return cachedClient$l;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$l = client;
  return client;
}
async function getSelectedTaskDetails(taskId) {
  const client = await getClient$l();
  const db = client.db("capture");
  const tasks = db.collection("tasks");
  const _id = new ObjectId(taskId);
  const doc = await tasks.findOne({ _id });
  return doc;
}
ipcMain.handle("db:getSelectedTaskDetails", async (_event, taskId) => {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { ok: false, error: "Invalid taskId" };
    }
    const doc = await getSelectedTaskDetails(taskId);
    if (!doc) return { ok: true, data: null };
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      name: doc.name,
      remarks: doc.remarks ?? void 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$k = null;
async function getClient$k() {
  if (cachedClient$k) return cachedClient$k;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$k = client;
  return client;
}
async function editTask(taskId, updates) {
  const client = await getClient$k();
  const db = client.db("capture");
  const tasks = db.collection("tasks");
  const _id = new ObjectId(taskId);
  const now = /* @__PURE__ */ new Date();
  const set = { updatedAt: now };
  if (typeof updates.name === "string") set.name = updates.name.trim();
  if (typeof updates.remarks === "string") set.remarks = updates.remarks.trim();
  const updated = await tasks.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: "after", includeResultMetadata: false }
  );
  if (!updated) {
    throw new Error("Task not found");
  }
  return updated;
}
ipcMain.handle("db:editTask", async (_event, taskId, updates) => {
  try {
    const updated = await editTask(taskId, updates);
    return { ok: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$j = null;
async function getClient$j() {
  if (cachedClient$j) return cachedClient$j;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$j = client;
  return client;
}
async function createDive(input) {
  const client = await getClient$j();
  const db = client.db("capture");
  const dives = db.collection("dives");
  const now = /* @__PURE__ */ new Date();
  const remarks = typeof input.remarks === "string" ? input.remarks.trim() : void 0;
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Dive name is required");
  }
  const existing = await dives.findOne({
    projectId: new ObjectId(input.projectId),
    name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
  if (existing) {
    throw new Error("A dive with this name already exists in this project");
  }
  const doc = {
    projectId: new ObjectId(input.projectId),
    name: trimmedName,
    ...remarks ? { remarks } : {},
    started: false,
    createdAt: now,
    updatedAt: now
  };
  const result = await dives.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createDive", async (_event, input) => {
  var _a, _b;
  try {
    const created = await createDive(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$i = null;
async function getClient$i() {
  if (cachedClient$i) return cachedClient$i;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$i = client;
  return client;
}
async function createSession(input) {
  const client = await getClient$i();
  const db = client.db("capture");
  const sessions = db.collection("sessions");
  const now = /* @__PURE__ */ new Date();
  const hasAnyVideo = [input.preview, input.ch1, input.ch2, input.ch3, input.ch4].some((v) => typeof v === "string" && v.trim().length > 0);
  if (!hasAnyVideo) {
    throw new Error("At least one of preview/ch1/ch2/ch3/ch4 must be provided");
  }
  const nodeObjectId = typeof input.nodeId === "string" && input.nodeId.trim() ? new ObjectId(input.nodeId.trim()) : null;
  const diveObjectId = new ObjectId(input.diveId);
  const taskObjectId = new ObjectId(input.taskId);
  const [diveDoc, taskDoc] = await Promise.all([
    db.collection("dives").findOne({ _id: diveObjectId }, { projection: { name: 1 } }),
    db.collection("tasks").findOne({ _id: taskObjectId }, { projection: { name: 1 } })
  ]);
  let nodesWithNames = [];
  if (nodeObjectId) {
    const nodesCol = db.collection("nodes");
    const chain = [];
    let currentId = nodeObjectId;
    while (currentId) {
      const nd = await nodesCol.findOne({ _id: currentId }, { projection: { name: 1, parentId: 1 } });
      if (!nd) break;
      chain.push({ id: currentId, name: String(nd.name || "") });
      const parentId = nd.parentId;
      if (!parentId) break;
      currentId = parentId;
    }
    nodesWithNames = chain.reverse();
  }
  let nodesHierarchy = void 0;
  if (nodesWithNames.length > 0) {
    for (let i = nodesWithNames.length - 1; i >= 0; i--) {
      const entry = nodesWithNames[i];
      if (!nodesHierarchy) {
        nodesHierarchy = { id: entry.id, name: entry.name };
      } else {
        nodesHierarchy = { id: nodesWithNames[i].id, name: nodesWithNames[i].name, children: nodesHierarchy };
      }
    }
  }
  const doc = {
    projectId: new ObjectId(input.projectId),
    diveId: diveObjectId,
    taskId: taskObjectId,
    dive: { id: diveObjectId, name: String((diveDoc == null ? void 0 : diveDoc.name) || "") },
    task: { id: taskObjectId, name: String((taskDoc == null ? void 0 : taskDoc.name) || "") },
    ...nodesHierarchy ? { nodesHierarchy } : {},
    ...input.preview && input.preview.trim() ? { preview: input.preview.trim() } : {},
    ...input.ch1 && input.ch1.trim() ? { ch1: input.ch1.trim() } : {},
    ...input.ch2 && input.ch2.trim() ? { ch2: input.ch2.trim() } : {},
    ...input.ch3 && input.ch3.trim() ? { ch3: input.ch3.trim() } : {},
    ...input.ch4 && input.ch4.trim() ? { ch4: input.ch4.trim() } : {},
    createdAt: now,
    updatedAt: now
  };
  const result = await sessions.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createSession", async (_event, input) => {
  var _a, _b;
  try {
    const created = await createSession(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$h = null;
async function getClient$h() {
  if (cachedClient$h) return cachedClient$h;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$h = client;
  return client;
}
async function editDive(diveId, updates) {
  const client = await getClient$h();
  const db = client.db("capture");
  const dives = db.collection("dives");
  const _id = new ObjectId(diveId);
  const now = /* @__PURE__ */ new Date();
  const set = { updatedAt: now };
  if (typeof updates.name === "string") set.name = updates.name.trim();
  if (typeof updates.remarks === "string") set.remarks = updates.remarks.trim();
  if (typeof updates.started === "boolean") set.started = updates.started;
  const updated = await dives.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: "after", includeResultMetadata: false }
  );
  if (!updated) {
    throw new Error("Dive not found");
  }
  return updated;
}
ipcMain.handle("db:editDive", async (_event, diveId, updates) => {
  try {
    const updated = await editDive(diveId, updates);
    return { ok: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$g = null;
async function getClient$g() {
  if (cachedClient$g) return cachedClient$g;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$g = client;
  return client;
}
async function createNode(input) {
  const client = await getClient$g();
  const db = client.db("capture");
  const nodes = db.collection("nodes");
  const now = /* @__PURE__ */ new Date();
  const projectObjectId = new ObjectId(input.projectId);
  let level = 0;
  let parentObjectId = void 0;
  if (input.parentId) {
    parentObjectId = new ObjectId(input.parentId);
    const parent = await nodes.findOne({ _id: parentObjectId });
    if (!parent) throw new Error("Parent node not found");
    if (!parent.projectId.equals(projectObjectId)) {
      throw new Error("Parent node belongs to a different project");
    }
    level = (parent.level ?? 0) + 1;
  }
  const remarks = typeof input.remarks === "string" ? input.remarks.trim() : void 0;
  const doc = {
    projectId: projectObjectId,
    name: input.name.trim(),
    ...parentObjectId ? { parentId: parentObjectId } : {},
    ...remarks ? { remarks } : {},
    level,
    createdAt: now,
    updatedAt: now
  };
  const result = await nodes.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createNode", async (_event, input) => {
  try {
    const created = await createNode(input);
    return { ok: true, data: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$f = null;
async function getClient$f() {
  if (cachedClient$f) return cachedClient$f;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$f = client;
  return client;
}
async function editNode(nodeId, updates) {
  const client = await getClient$f();
  const db = client.db("capture");
  const nodes = db.collection("nodes");
  const _id = new ObjectId(nodeId);
  const now = /* @__PURE__ */ new Date();
  const set = { updatedAt: now };
  if (typeof updates.name === "string") set.name = updates.name.trim();
  if (typeof updates.remarks === "string") set.remarks = updates.remarks.trim();
  const updated = await nodes.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: "after", includeResultMetadata: false }
  );
  if (!updated) {
    throw new Error("Node not found");
  }
  return updated;
}
ipcMain.handle("db:editNode", async (_event, nodeId, updates) => {
  try {
    const updated = await editNode(nodeId, updates);
    return { ok: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$e = null;
async function getClient$e() {
  if (cachedClient$e) return cachedClient$e;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$e = client;
  return client;
}
async function getAllNodes(projectId) {
  const client = await getClient$e();
  const db = client.db("capture");
  const nodesCol = db.collection("nodes");
  const projectObjectId = new ObjectId(projectId);
  const nodes = await nodesCol.find({ projectId: projectObjectId }).sort({ level: 1, createdAt: 1, name: 1 }).toArray();
  const idToNode = /* @__PURE__ */ new Map();
  const roots = [];
  for (const n of nodes) {
    idToNode.set(n._id.toHexString(), { ...n, children: [] });
  }
  for (const n of nodes) {
    const current = idToNode.get(n._id.toHexString());
    if (n.parentId) {
      const parent = idToNode.get(n.parentId.toHexString());
      if (parent) parent.children.push(current);
      else roots.push(current);
    } else {
      roots.push(current);
    }
  }
  return roots;
}
ipcMain.handle("db:getAllNodes", async (_event, projectId) => {
  try {
    const roots = await getAllNodes(projectId);
    const toPlain = (n) => {
      var _a, _b, _c, _d, _e, _f;
      return {
        _id: ((_b = (_a = n._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? n._id,
        projectId: ((_d = (_c = n.projectId) == null ? void 0 : _c.toString) == null ? void 0 : _d.call(_c)) ?? n.projectId,
        parentId: n.parentId ? ((_f = (_e = n.parentId).toString) == null ? void 0 : _f.call(_e)) ?? n.parentId : void 0,
        name: n.name,
        level: n.level,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        children: Array.isArray(n.children) ? n.children.map(toPlain) : []
      };
    };
    return { ok: true, data: roots.map(toPlain) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$d = null;
async function getClient$d() {
  if (cachedClient$d) return cachedClient$d;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$d = client;
  return client;
}
async function deleteNode(nodeId) {
  const client = await getClient$d();
  const db = client.db("capture");
  const nodes = db.collection("nodes");
  const rootId = new ObjectId(nodeId);
  const gathered = /* @__PURE__ */ new Set([rootId.toHexString()]);
  let frontier = [rootId];
  while (frontier.length) {
    const children = await nodes.find({ parentId: { $in: frontier } }, { projection: { _id: 1 } }).toArray();
    const next = [];
    for (const c of children) {
      const idHex = c._id.toHexString();
      if (!gathered.has(idHex)) {
        gathered.add(idHex);
        next.push(c._id);
      }
    }
    frontier = next;
  }
  const idsToDelete = Array.from(gathered).map((hex) => new ObjectId(hex));
  const result = await nodes.deleteMany({ _id: { $in: idsToDelete } });
  return result.deletedCount ?? 0;
}
ipcMain.handle("db:deleteNode", async (_event, nodeId) => {
  try {
    const deletedCount = await deleteNode(nodeId);
    return { ok: true, data: { deletedCount } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$c = null;
async function getClient$c() {
  if (cachedClient$c) return cachedClient$c;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$c = client;
  return client;
}
async function getSelectedNodeDetails(nodeId) {
  const client = await getClient$c();
  const db = client.db("capture");
  const nodes = db.collection("nodes");
  const _id = new ObjectId(nodeId);
  const doc = await nodes.findOne({ _id });
  return doc;
}
ipcMain.handle("db:getSelectedNodeDetails", async (_event, nodeId) => {
  try {
    if (!nodeId || typeof nodeId !== "string") {
      return { ok: false, error: "Invalid nodeId" };
    }
    const doc = await getSelectedNodeDetails(nodeId);
    if (!doc) return { ok: true, data: null };
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      parentId: doc.parentId ? doc.parentId.toString() : void 0,
      name: doc.name,
      remarks: doc.remarks ?? void 0,
      level: doc.level,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$b = null;
async function getClient$b() {
  if (cachedClient$b) return cachedClient$b;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$b = client;
  return client;
}
async function getAllProjects() {
  const client = await getClient$b();
  const db = client.db("capture");
  const projects = db.collection("projects");
  return projects.find({}).sort({ createdAt: -1 }).toArray();
}
ipcMain.handle("db:getAllProjects", async () => {
  try {
    const projects = await getAllProjects();
    const plain = projects.map((p) => ({
      _id: p._id.toString(),
      name: p.name,
      client: p.client,
      contractor: p.contractor,
      vessel: p.vessel,
      location: p.location,
      projectType: p.projectType,
      lastSelectedDiveId: p.lastSelectedDiveId ?? null,
      lastSelectedTaskId: p.lastSelectedTaskId ?? null,
      lastSelectedNodeId: p.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: p.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: p.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: p.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: p.lastSelectedOverlayCh4Id ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedProjectId = null;
function setSelectedProjectId(id) {
  selectedProjectId = id ? id.trim() || null : null;
}
function getSelectedProjectId() {
  return selectedProjectId;
}
ipcMain.handle("app:setSelectedProjectId", async (_event, id) => {
  try {
    setSelectedProjectId(id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedProjectId", async () => {
  try {
    return { ok: true, data: getSelectedProjectId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedDiveId = null;
function setSelectedDiveId(id) {
  selectedDiveId = id ? id.trim() || null : null;
}
function getSelectedDiveId() {
  return selectedDiveId;
}
ipcMain.handle("app:setSelectedDiveId", async (_event, id) => {
  try {
    setSelectedDiveId(id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedDiveId", async () => {
  try {
    return { ok: true, data: getSelectedDiveId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let startedDiveId = null;
function getStartedDiveId() {
  return startedDiveId;
}
function setDiveStarted(diveId, started) {
  if (started) {
    startedDiveId = diveId ? diveId.trim() || null : null;
  } else {
    if (startedDiveId && diveId && startedDiveId === diveId.trim()) {
      startedDiveId = null;
    } else if (!diveId) {
      startedDiveId = null;
    }
  }
}
ipcMain.handle("dive:getStartedDiveId", async () => {
  try {
    return { ok: true, data: getStartedDiveId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("dive:isStarted", async (_event, diveId) => {
  try {
    const id = typeof diveId === "string" ? diveId.trim() || null : null;
    return { ok: true, data: !!(id && startedDiveId === id) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("dive:setStarted", async (_event, diveId, started) => {
  try {
    setDiveStarted(typeof diveId === "string" ? diveId : null, !!started);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedTaskId = null;
function setSelectedTaskId(id) {
  selectedTaskId = id ? id.trim() || null : null;
}
function getSelectedTaskId() {
  return selectedTaskId;
}
ipcMain.handle("app:setSelectedTaskId", async (_event, id) => {
  try {
    setSelectedTaskId(id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedTaskId", async () => {
  try {
    return { ok: true, data: getSelectedTaskId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedNodeId = null;
function setSelectedNodeId(id) {
  selectedNodeId = id ? id.trim() || null : null;
}
function getSelectedNodeId() {
  return selectedNodeId;
}
ipcMain.handle("app:setSelectedNodeId", async (_event, id) => {
  try {
    setSelectedNodeId(id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedNodeId", async () => {
  try {
    return { ok: true, data: getSelectedNodeId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$a = null;
async function getClient$a() {
  if (cachedClient$a) return cachedClient$a;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$a = client;
  return client;
}
async function getAllDives(projectId) {
  const client = await getClient$a();
  const db = client.db("capture");
  const dives = db.collection("dives");
  return dives.find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
}
ipcMain.handle("db:getAllDives", async (_event, projectId) => {
  try {
    if (!projectId || typeof projectId !== "string") {
      return { ok: false, error: "projectId is required" };
    }
    const items = await getAllDives(projectId);
    const plain = items.map((d) => {
      var _a, _b, _c, _d;
      return {
        _id: ((_b = (_a = d._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? d._id,
        projectId: ((_d = (_c = d.projectId) == null ? void 0 : _c.toString) == null ? void 0 : _d.call(_c)) ?? d.projectId,
        name: d.name,
        remarks: d.remarks,
        started: !!d.started,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      };
    });
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$9 = null;
async function getClient$9() {
  if (cachedClient$9) return cachedClient$9;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$9 = client;
  return client;
}
async function getSelectedProjectDetails(projectId) {
  const client = await getClient$9();
  const db = client.db("capture");
  const projects = db.collection("projects");
  const _id = new ObjectId(projectId);
  const doc = await projects.findOne({ _id });
  return doc;
}
ipcMain.handle("db:getSelectedProjectDetails", async (_event, projectId) => {
  try {
    if (!projectId || typeof projectId !== "string") {
      return { ok: false, error: "Invalid projectId" };
    }
    const doc = await getSelectedProjectDetails(projectId);
    if (!doc) return { ok: true, data: null };
    const plain = {
      _id: doc._id.toString(),
      name: doc.name,
      client: doc.client,
      contractor: doc.contractor,
      vessel: doc.vessel,
      location: doc.location,
      projectType: doc.projectType,
      lastSelectedDiveId: doc.lastSelectedDiveId ?? null,
      lastSelectedTaskId: doc.lastSelectedTaskId ?? null,
      lastSelectedNodeId: doc.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: doc.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: doc.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: doc.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: doc.lastSelectedOverlayCh4Id ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$8 = null;
async function getClient$8() {
  if (cachedClient$8) return cachedClient$8;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$8 = client;
  return client;
}
async function getSelectedDiveDetails(diveId) {
  const client = await getClient$8();
  const db = client.db("capture");
  const dives = db.collection("dives");
  const _id = new ObjectId(diveId);
  const doc = await dives.findOne({ _id });
  return doc;
}
ipcMain.handle("db:getSelectedDiveDetails", async (_event, diveId) => {
  try {
    if (!diveId || typeof diveId !== "string") {
      return { ok: false, error: "Invalid diveId" };
    }
    const doc = await getSelectedDiveDetails(diveId);
    if (!doc) return { ok: true, data: null };
    const plain = {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      name: doc.name,
      remarks: doc.remarks ?? void 0,
      started: !!doc.started,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$7 = null;
async function getClient$7() {
  if (cachedClient$7) return cachedClient$7;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$7 = client;
  return client;
}
async function editProject(projectId, updates) {
  const client = await getClient$7();
  const db = client.db("capture");
  const projects = db.collection("projects");
  const _id = new ObjectId(projectId);
  const now = /* @__PURE__ */ new Date();
  const set = { updatedAt: now };
  if (typeof updates.name === "string") set.name = updates.name.trim();
  if (typeof updates.client === "string") set.client = updates.client.trim();
  if (typeof updates.contractor === "string") set.contractor = updates.contractor.trim();
  if (typeof updates.vessel === "string") set.vessel = updates.vessel.trim();
  if (typeof updates.location === "string") set.location = updates.location.trim();
  if (updates.hasOwnProperty("lastSelectedDiveId")) {
    const v = updates.lastSelectedDiveId;
    set.lastSelectedDiveId = typeof v === "string" ? v.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedTaskId")) {
    const v2 = updates.lastSelectedTaskId;
    set.lastSelectedTaskId = typeof v2 === "string" ? v2.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedNodeId")) {
    const v3 = updates.lastSelectedNodeId;
    set.lastSelectedNodeId = typeof v3 === "string" ? v3.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedOverlayCh1Id")) {
    const v4 = updates.lastSelectedOverlayCh1Id;
    set.lastSelectedOverlayCh1Id = typeof v4 === "string" ? v4.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedOverlayCh2Id")) {
    const v5 = updates.lastSelectedOverlayCh2Id;
    set.lastSelectedOverlayCh2Id = typeof v5 === "string" ? v5.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedOverlayCh3Id")) {
    const v6 = updates.lastSelectedOverlayCh3Id;
    set.lastSelectedOverlayCh3Id = typeof v6 === "string" ? v6.trim() || null : null;
  }
  if (updates.hasOwnProperty("lastSelectedOverlayCh4Id")) {
    const v7 = updates.lastSelectedOverlayCh4Id;
    set.lastSelectedOverlayCh4Id = typeof v7 === "string" ? v7.trim() || null : null;
  }
  const updated = await projects.findOneAndUpdate(
    { _id },
    { $set: set },
    { returnDocument: "after", includeResultMetadata: false }
  );
  if (!updated) {
    throw new Error("Project not found");
  }
  return updated;
}
ipcMain.handle("db:editProject", async (_event, projectId, updates) => {
  try {
    const updated = await editProject(projectId, updates);
    const plain = {
      _id: updated._id.toString(),
      name: updated.name,
      client: updated.client,
      contractor: updated.contractor,
      vessel: updated.vessel,
      location: updated.location,
      projectType: updated.projectType,
      lastSelectedDiveId: updated.lastSelectedDiveId ?? null,
      lastSelectedTaskId: updated.lastSelectedTaskId ?? null,
      lastSelectedNodeId: updated.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: updated.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: updated.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: updated.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: updated.lastSelectedOverlayCh4Id ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedDrawingTool = null;
function setSelectedDrawingTool(tool) {
  selectedDrawingTool = tool;
}
function getSelectedDrawingTool() {
  return selectedDrawingTool;
}
ipcMain.handle("app:setSelectedDrawingTool", async (_event, tool) => {
  try {
    setSelectedDrawingTool(tool);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedDrawingTool", async () => {
  try {
    return { ok: true, data: getSelectedDrawingTool() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedOverlayLayerId = null;
function setSelectedOverlayLayerId(id) {
  selectedOverlayLayerId = id ? id.trim() || null : null;
}
function getSelectedOverlayLayerId() {
  return selectedOverlayLayerId;
}
ipcMain.handle("app:setSelectedOverlayLayerId", async (_event, id) => {
  try {
    setSelectedOverlayLayerId(id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedOverlayLayerId", async () => {
  try {
    return { ok: true, data: getSelectedOverlayLayerId() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let selectedOverlayComponentIds = [];
function setSelectedOverlayComponentIds(ids) {
  if (!ids || !Array.isArray(ids)) {
    selectedOverlayComponentIds = [];
    return;
  }
  const cleaned = ids.map((s) => typeof s === "string" ? s.trim() : "").filter((s) => !!s);
  selectedOverlayComponentIds = Array.from(new Set(cleaned));
}
function getSelectedOverlayComponentIds() {
  return [...selectedOverlayComponentIds];
}
ipcMain.handle("app:setSelectedOverlayComponentIds", async (_event, ids) => {
  try {
    setSelectedOverlayComponentIds(ids);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("app:getSelectedOverlayComponentIds", async () => {
  try {
    return { ok: true, data: getSelectedOverlayComponentIds() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$6 = null;
async function getClient$6() {
  if (cachedClient$6) return cachedClient$6;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$6 = client;
  return client;
}
async function renameOverlay(id, name) {
  const client = await getClient$6();
  const db = client.db("capture");
  const overlays = db.collection("overlays");
  const _id = new ObjectId(id);
  const now = /* @__PURE__ */ new Date();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Overlay name is required");
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await overlays.findOne({ _id: { $ne: _id }, name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" } });
  if (existing) throw new Error("An overlay with this name already exists");
  await overlays.updateOne({ _id }, { $set: { name: trimmed, updatedAt: now } });
  const updated = await overlays.findOne({ _id });
  return updated;
}
ipcMain.handle("db:renameOverlay", async (_event, input) => {
  var _a, _b;
  try {
    if (!(input == null ? void 0 : input.id) || !(input == null ? void 0 : input.name) || !input.name.trim()) throw new Error("Invalid input");
    const updated = await renameOverlay(input.id, input.name);
    const idStr = ((_b = (_a = updated == null ? void 0 : updated._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? input.id;
    try {
      const payload = { id: idStr, name: input.name, action: "renamed" };
      for (const win2 of BrowserWindow.getAllWindows()) {
        try {
          win2.webContents.send("overlays:changed", payload);
        } catch {
        }
      }
    } catch {
    }
    return { ok: true, data: idStr };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$5 = null;
async function getClient$5() {
  if (cachedClient$5) return cachedClient$5;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$5 = client;
  return client;
}
async function deleteOverlay(id) {
  const client = await getClient$5();
  const db = client.db("capture");
  const overlays = db.collection("overlays");
  const _id = new ObjectId(id);
  const res = await overlays.deleteOne({ _id });
  return res.deletedCount === 1;
}
ipcMain.handle("db:deleteOverlay", async (_event, input) => {
  try {
    if (!(input == null ? void 0 : input.id)) throw new Error("Invalid id");
    const ok = await deleteOverlay(input.id);
    if (!ok) throw new Error("Overlay not found");
    try {
      const payload = { id: input.id, action: "deleted" };
      for (const win2 of BrowserWindow.getAllWindows()) {
        try {
          win2.webContents.send("overlays:changed", payload);
        } catch {
        }
      }
    } catch {
    }
    return { ok: true, data: input.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$4 = null;
async function getClient$4() {
  if (cachedClient$4) return cachedClient$4;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$4 = client;
  return client;
}
async function createOverlayComponent(input) {
  if (!(input == null ? void 0 : input.overlayId)) throw new Error("overlayId is required");
  if (!(input == null ? void 0 : input.type)) throw new Error("type is required");
  const overlayObjectId = new ObjectId(input.overlayId);
  const isTextCapable = input.type !== "image";
  const defaultTextStyle = isTextCapable ? {
    fontFamily: "Inter, ui-sans-serif, system-ui",
    fontSize: 16,
    fontWeight: "normal",
    color: "#FFFFFF",
    align: "left",
    letterSpacing: 0,
    lineHeight: 1.2,
    italic: false,
    underline: false,
    uppercase: false
  } : void 0;
  let customFields = {};
  switch (input.type) {
    case "custom-text":
      customFields.customText = input.customText ?? "Text";
      break;
    case "date":
      customFields.dateFormat = input.dateFormat ?? "YYYY-MM-DD";
      break;
    case "time":
      customFields.twentyFourHour = input.twentyFourHour ?? true;
      customFields.useUTC = input.useUTC ?? false;
      break;
    case "data":
      customFields.dataType = input.dataType ?? "string";
      break;
    case "node":
      customFields.nodeLevel = input.nodeLevel ?? 1;
      break;
    case "image":
      customFields.imagePath = input.imagePath ?? "";
      break;
  }
  const client = await getClient$4();
  const db = client.db("capture");
  const components = db.collection("overlay_components");
  const existingCount = await components.countDocuments({ overlayId: overlayObjectId });
  const defaultName = `${input.type}-${existingCount + 1}`;
  const defaultX = 100;
  const defaultY = 100;
  const defaultWidth = 320;
  const defaultHeight = 64;
  const doc = {
    overlayId: overlayObjectId,
    name: input.name && input.name.trim() ? input.name.trim() : defaultName,
    type: input.type,
    x: Number.isFinite(Number(input.x)) ? Number(input.x) : defaultX,
    y: Number.isFinite(Number(input.y)) ? Number(input.y) : defaultY,
    width: Math.max(1, Number.isFinite(Number(input.width)) ? Number(input.width) : defaultWidth),
    height: Math.max(1, Number.isFinite(Number(input.height)) ? Number(input.height) : defaultHeight),
    backgroundColor: input.backgroundColor ?? "transparent",
    borderColor: input.borderColor ?? "transparent",
    radius: typeof input.radius === "number" ? input.radius : 0,
    textStyle: isTextCapable ? { ...defaultTextStyle, ...input.textStyle ?? {} } : void 0,
    ...customFields,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
  const result = await components.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
ipcMain.handle("db:createOverlayComponent", async (_event, input) => {
  var _a, _b;
  try {
    const created = await createOverlayComponent(input);
    const id = ((_b = (_a = created == null ? void 0 : created._id) == null ? void 0 : _a.toString) == null ? void 0 : _b.call(_a)) ?? created;
    return { ok: true, data: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$3 = null;
async function getClient$3() {
  if (cachedClient$3) return cachedClient$3;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$3 = client;
  return client;
}
async function getAllOverlayComponents(overlayId) {
  const client = await getClient$3();
  const db = client.db("capture");
  const components = db.collection("overlay_components");
  const filter = overlayId ? { overlayId: new ObjectId(overlayId) } : {};
  const cursor = components.find(filter, { projection: { _id: 1, name: 1 } }).sort({ createdAt: -1 });
  return cursor.toArray();
}
ipcMain.handle("db:getAllOverlayComponents", async (_event, input) => {
  try {
    const items = await getAllOverlayComponents(input == null ? void 0 : input.overlayId);
    const plain = items.map((i) => ({ _id: i._id.toString(), name: i.name }));
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$2 = null;
async function getClient$2() {
  if (cachedClient$2) return cachedClient$2;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$2 = client;
  return client;
}
function buildSetObject(updates) {
  const $set = { updatedAt: /* @__PURE__ */ new Date() };
  if (typeof updates.overlayId === "string" && updates.overlayId.trim()) {
    $set.overlayId = new ObjectId(updates.overlayId);
  }
  if (typeof updates.name === "string") $set.name = updates.name.trim();
  if (typeof updates.type === "string") $set.type = updates.type;
  if (typeof updates.x === "number") $set.x = updates.x;
  if (typeof updates.y === "number") $set.y = updates.y;
  if (typeof updates.width === "number") $set.width = Math.max(1, updates.width);
  if (typeof updates.height === "number") $set.height = Math.max(1, updates.height);
  if (typeof updates.backgroundColor === "string") $set.backgroundColor = updates.backgroundColor;
  if (typeof updates.borderColor === "string") $set.borderColor = updates.borderColor;
  if (typeof updates.radius === "number") $set.radius = updates.radius;
  if (typeof updates.textStyle === "object" && updates.textStyle) $set.textStyle = updates.textStyle;
  if (typeof updates.customText === "string") $set.customText = updates.customText;
  if (typeof updates.dateFormat === "string") $set.dateFormat = updates.dateFormat;
  if (typeof updates.twentyFourHour === "boolean") $set.twentyFourHour = updates.twentyFourHour;
  if (typeof updates.useUTC === "boolean") $set.useUTC = updates.useUTC;
  if (typeof updates.dataType === "string") $set.dataType = updates.dataType;
  if (typeof updates.nodeLevel === "number") $set.nodeLevel = updates.nodeLevel;
  if (typeof updates.imagePath === "string") $set.imagePath = updates.imagePath;
  return $set;
}
async function editOverlayComponents(ids, updates) {
  const client = await getClient$2();
  const db = client.db("capture");
  const components = db.collection("overlay_components");
  const cleaned = Array.from(new Set((ids || []).map((s) => typeof s === "string" ? s.trim() : "").filter(Boolean)));
  if (!cleaned.length) return 0;
  const objectIds = cleaned.map((id) => new ObjectId(id));
  const $set = buildSetObject(updates);
  const res = await components.updateMany({ _id: { $in: objectIds } }, { $set });
  return res.modifiedCount ?? 0;
}
ipcMain.handle("db:editOverlayComponent", async (_event, input) => {
  try {
    if (!input || !Array.isArray(input.ids) || !input.updates || typeof input.updates !== "object") throw new Error("Invalid input");
    const modified = await editOverlayComponents(input.ids, input.updates);
    if (modified === 0) throw new Error("Overlay component(s) not found");
    return { ok: true, data: { ids: input.ids, modified } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient$1 = null;
async function getClient$1() {
  if (cachedClient$1) return cachedClient$1;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient$1 = client;
  return client;
}
async function deleteOverlayComponents(ids) {
  const cleanedIds = Array.from(new Set((ids || []).map((s) => typeof s === "string" ? s.trim() : "").filter(Boolean)));
  if (!cleanedIds.length) return 0;
  const client = await getClient$1();
  const db = client.db("capture");
  const components = db.collection("overlay_components");
  const objectIds = cleanedIds.map((id) => new ObjectId(id));
  const res = await components.deleteMany({ _id: { $in: objectIds } });
  return res.deletedCount ?? 0;
}
ipcMain.handle("db:deleteOverlayComponent", async (_event, input) => {
  try {
    if (!input || !Array.isArray(input.ids)) throw new Error("Invalid ids");
    const deleted = await deleteOverlayComponents(input.ids);
    return { ok: true, data: { ids: input.ids, deleted } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await client.connect();
  cachedClient = client;
  return client;
}
async function getOverlayComponentsForRender(overlayId) {
  const client = await getClient();
  const db = client.db("capture");
  const components = db.collection("overlay_components");
  const filter = { overlayId: new ObjectId(overlayId) };
  const projection = {
    _id: 1,
    name: 1,
    type: 1,
    x: 1,
    y: 1,
    width: 1,
    height: 1,
    backgroundColor: 1,
    borderColor: 1,
    radius: 1,
    textStyle: 1,
    customText: 1,
    dateFormat: 1,
    twentyFourHour: 1,
    useUTC: 1,
    dataType: 1,
    nodeLevel: 1,
    imagePath: 1,
    createdAt: 1,
    updatedAt: 1
  };
  const cursor = components.find(filter, { projection }).sort({ createdAt: 1 });
  const list = await cursor.toArray();
  return list;
}
ipcMain.handle("db:getOverlayComponentsForRender", async (_event, input) => {
  try {
    if (!(input == null ? void 0 : input.overlayId)) throw new Error("overlayId is required");
    const items = await getOverlayComponentsForRender(input.overlayId);
    const plain = items.map((i) => ({
      _id: i._id.toString(),
      name: i.name,
      type: i.type,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      backgroundColor: i.backgroundColor,
      borderColor: i.borderColor,
      radius: i.radius,
      textStyle: i.textStyle,
      customText: i.customText,
      dateFormat: i.dateFormat,
      twentyFourHour: i.twentyFourHour,
      useUTC: i.useUTC,
      dataType: i.dataType,
      nodeLevel: i.nodeLevel,
      imagePath: i.imagePath,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt
    }));
    return { ok: true, data: plain };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
function ensureImagesDir$1() {
  if (process.platform !== "win32") {
    throw new Error("This application supports Windows only");
  }
  const baseDir = app.getPath("userData");
  const imagesDir = path.join(baseDir, "overlay-images");
  try {
    fs.mkdirSync(imagesDir, { recursive: true });
  } catch {
  }
  return imagesDir;
}
function isAllowedExt$1(ext) {
  const e = ext.toLowerCase();
  return e === ".png" || e === ".jpg" || e === ".jpeg" || e === ".webp" || e === ".bmp";
}
function buildTargetFilename(sourceName) {
  const ext = path.extname(sourceName || "").toLowerCase();
  if (!isAllowedExt$1(ext)) throw new Error("Unsupported image type");
  const base = path.basename(sourceName, ext);
  const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "image";
  const stamp = /* @__PURE__ */ new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const mm = String(stamp.getMinutes()).padStart(2, "0");
  const ss = String(stamp.getSeconds()).padStart(2, "0");
  return `${safeBase}_${y}${m}${d}_${hh}${mm}${ss}${ext}`;
}
async function handleUpload(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid input");
  const imagesDir = ensureImagesDir$1();
  if (input.sourcePath) {
    const src = path.resolve(input.sourcePath);
    const stat = fs.statSync(src);
    if (!stat.isFile()) throw new Error("Source is not a file");
    const filename = buildTargetFilename(path.basename(src));
    const dest = path.join(imagesDir, filename);
    fs.copyFileSync(src, dest);
    const fileUrl = `file://${dest.replace(/\\/g, "/")}`;
    const httpUrl = buildHttpUrl(filename);
    return { absolutePath: dest, fileUrl, httpUrl, filename };
  }
  if (input.bytesBase64) {
    const rawName = input.filename && input.filename.trim() ? input.filename.trim() : "image.png";
    const filename = buildTargetFilename(rawName);
    const dest = path.join(imagesDir, filename);
    const buffer = Buffer.from(input.bytesBase64, "base64");
    fs.writeFileSync(dest, buffer);
    const fileUrl = `file://${dest.replace(/\\/g, "/")}`;
    const httpUrl = buildHttpUrl(filename);
    return { absolutePath: dest, fileUrl, httpUrl, filename };
  }
  throw new Error("Provide either sourcePath or bytesBase64");
}
function buildHttpUrl(filename) {
  try {
    const port = Number(process.env.OVERLAY_WS_PORT || OVERLAY_WS_PORT || 3620) || 3620;
    return `http://127.0.0.1:${port}/images/${encodeURIComponent(filename)}`;
  } catch {
    return "";
  }
}
ipcMain.handle("fs:uploadOverlayImage", async (_event, input) => {
  try {
    const result = await handleUpload(input);
    return { ok: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
function ensureImagesDir() {
  if (process.platform !== "win32") {
    throw new Error("This application supports Windows only");
  }
  const baseDir = app.getPath("userData");
  const imagesDir = path.join(baseDir, "overlay-images");
  try {
    fs.mkdirSync(imagesDir, { recursive: true });
  } catch {
  }
  return imagesDir;
}
function isAllowedExt(ext) {
  const e = ext.toLowerCase();
  return e === ".png" || e === ".jpg" || e === ".jpeg" || e === ".webp" || e === ".bmp";
}
function toFileUrl(p) {
  return `file://${p.replace(/\\/g, "/")}`;
}
function toHttpUrl(filename) {
  try {
    const port = Number(process.env.OVERLAY_WS_PORT || 3620) || 3620;
    return `http://127.0.0.1:${port}/images/${encodeURIComponent(filename)}`;
  } catch {
    return "";
  }
}
function listAllImages() {
  const dir = ensureImagesDir();
  let entries = [];
  try {
    const files = fs.readdirSync(dir);
    for (const name of files) {
      try {
        const ext = path.extname(name);
        if (!isAllowedExt(ext)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        entries.push({
          absolutePath: full,
          fileUrl: toFileUrl(full),
          httpUrl: toHttpUrl(name),
          filename: name,
          size: stat.size,
          modifiedAt: new Date(stat.mtimeMs).toISOString()
        });
      } catch {
      }
    }
  } catch {
  }
  entries.sort((a, b) => a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0);
  return entries;
}
ipcMain.handle("fs:getAllOverlayImages", async () => {
  try {
    const items = listAllImages();
    return { ok: true, data: items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
const TARGET_SCENE = "video sources";
const TARGET_GROUP = "source 1";
const TARGET_INPUT = "video capture device 1";
async function getLiveDevices() {
  const obs = getObsClient();
  if (!obs) return [];
  try {
    try {
      const groupItems = await obs.call("GetGroupSceneItemList", { groupName: TARGET_GROUP });
      const hasInput = Array.isArray(groupItems == null ? void 0 : groupItems.sceneItems) ? groupItems.sceneItems.some((it) => String((it == null ? void 0 : it.sourceName) ?? "").toLowerCase() === TARGET_INPUT) : false;
      if (!hasInput) {
        try {
          const sceneRes = await obs.call("GetSceneItemList", { sceneName: TARGET_SCENE });
          const hasGroup = Array.isArray(sceneRes == null ? void 0 : sceneRes.sceneItems) ? sceneRes.sceneItems.some((it) => String((it == null ? void 0 : it.sourceName) ?? "").toLowerCase() === TARGET_GROUP) : false;
          if (!hasGroup) {
          }
        } catch {
        }
      }
    } catch {
    }
    try {
      const inputs = await obs.call("GetInputList");
      const target = (Array.isArray(inputs == null ? void 0 : inputs.inputs) ? inputs.inputs : []).find((i) => String((i == null ? void 0 : i.inputName) ?? "").toLowerCase() === TARGET_INPUT);
      if (!target) {
      } else {
      }
    } catch {
    }
    const devices = [];
    const tryProperty = async (propertyName) => {
      try {
        const res = await obs.call("GetInputPropertiesListPropertyItems", {
          inputName: TARGET_INPUT,
          propertyName
        });
        const items = Array.isArray(res == null ? void 0 : res.propertyItems) ? res.propertyItems : [];
        for (const it of items) {
          const name = String((it == null ? void 0 : it.itemName) ?? (it == null ? void 0 : it.name) ?? "").trim();
          const id = String((it == null ? void 0 : it.itemValue) ?? (it == null ? void 0 : it.value) ?? "").trim();
          if (name && id && !devices.some((d) => d.id === id)) {
            devices.push({ id, name });
          }
        }
      } catch {
      }
    };
    await tryProperty("video_device_id");
    return devices.filter((d) => !/obs/i.test(d.name));
  } catch {
    return [];
  }
}
ipcMain.handle("obs:get-live-devices", async () => {
  try {
    const list = await getLiveDevices();
    return list;
  } catch {
    return [];
  }
});
async function getRecordingDirectory() {
  const obs = getObsClient();
  if (!obs) return "";
  try {
    const { recordDirectory } = await obs.call("GetRecordDirectory");
    return typeof recordDirectory === "string" ? recordDirectory : "";
  } catch {
    return "";
  }
}
ipcMain.handle("obs:get-recording-directory", async () => {
  try {
    const dir = await getRecordingDirectory();
    return dir;
  } catch {
    return "";
  }
});
async function getFileNameFormatting() {
  const obs = getObsClient();
  if (!obs) {
    return { preview: "", ch1: "", ch2: "", ch3: "", ch4: "" };
  }
  let preview = "";
  try {
    const { parameterValue } = await obs.call("GetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting"
    });
    preview = typeof parameterValue === "string" ? parameterValue : "";
  } catch {
    preview = "";
  }
  const sources = ["channel 1", "channel 2", "channel 3", "channel 4"];
  const results = ["", "", "", ""];
  for (let i = 0; i < sources.length; i++) {
    const sourceName = sources[i];
    try {
      const { filterSettings } = await obs.call("GetSourceFilter", {
        sourceName,
        filterName: "source record"
      });
      const value = filterSettings && typeof filterSettings.filename_formatting === "string" ? filterSettings.filename_formatting : "";
      results[i] = value;
    } catch {
      results[i] = "";
    }
  }
  return {
    preview,
    ch1: results[0] || "",
    ch2: results[1] || "",
    ch3: results[2] || "",
    ch4: results[3] || ""
  };
}
ipcMain.handle("obs:get-file-name-formatting", async () => {
  try {
    const value = await getFileNameFormatting();
    return value;
  } catch {
    return { preview: "", ch1: "", ch2: "", ch3: "", ch4: "" };
  }
});
async function setFileNameFormatting(format) {
  const obs = getObsClient();
  if (!obs) return false;
  let allOk = true;
  try {
    await obs.call("SetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting",
      parameterValue: `preview-${format}`
    });
  } catch {
    allOk = false;
  }
  const sources = [
    "channel 1",
    "channel 2",
    "channel 3",
    "channel 4"
  ];
  for (let i = 0; i < sources.length; i++) {
    const sourceName = sources[i];
    const channelIndex = i + 1;
    try {
      await obs.call("SetSourceFilterSettings", {
        sourceName,
        filterName: "source record",
        filterSettings: { filename_formatting: `ch${channelIndex}-${format}` },
        overlay: true
      });
    } catch {
      allOk = false;
    }
  }
  return allOk;
}
ipcMain.handle("obs:set-file-name-formatting", async (_e, format) => {
  try {
    const ok = await setFileNameFormatting(format);
    return ok;
  } catch {
    return false;
  }
});
async function setClipRecordingFileNameFormatting(format) {
  const obs = getObsClient();
  if (!obs) return false;
  let ok = true;
  try {
    await obs.call("SetSourceFilterSettings", {
      sourceName: "clip recording",
      filterName: "source record",
      filterSettings: { filename_formatting: `clip-${format}` },
      overlay: true
    });
  } catch {
    ok = false;
  }
  return ok;
}
ipcMain.handle("obs:set-clip-file-name-formatting", async (_e, format) => {
  try {
    const ok = await setClipRecordingFileNameFormatting(format);
    return ok;
  } catch {
    return false;
  }
});
async function startClipRecording() {
  const obs = getObsClient();
  if (!obs) return false;
  try {
    await obs.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_5",
      keyModifiers: { shift: false, control: true, alt: false, command: false }
    });
    return true;
  } catch {
    return false;
  }
}
ipcMain.handle("obs:start-clip-recording", async () => {
  try {
    const ok = await startClipRecording();
    return ok;
  } catch {
    return false;
  }
});
async function stopClipRecording() {
  const obs = getObsClient();
  if (!obs) return false;
  try {
    await obs.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_6",
      keyModifiers: { shift: false, control: true, alt: false, command: false }
    });
    return true;
  } catch {
    return false;
  }
}
ipcMain.handle("obs:stop-clip-recording", async () => {
  try {
    const ok = await stopClipRecording();
    return ok;
  } catch {
    return false;
  }
});
let recordingState = {
  isRecordingStarted: false,
  isRecordingPaused: false,
  isRecordingStopped: false,
  isClipRecordingStarted: false
};
function getRecordingState() {
  return recordingState;
}
function updateRecordingState(patch) {
  recordingState = { ...recordingState, ...patch };
}
ipcMain.handle("recording:getState", async () => {
  try {
    return { ok: true, data: getRecordingState() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
ipcMain.handle("recording:updateState", async (_e, patch) => {
  try {
    updateRecordingState(patch || {});
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
async function startRecording(preview, ch1, ch2, ch3, ch4) {
  const obs = getObsClient();
  if (!obs) return false;
  let allOk = true;
  if (preview) {
    try {
      await obs.call("StartRecord");
    } catch {
      allOk = false;
    }
  }
  async function triggerCtrlNumber(numberKey) {
    const keyId = `OBS_KEY_${numberKey}`;
    try {
      await obs.call("TriggerHotkeyByKeySequence", {
        keyId,
        keyModifiers: { shift: false, control: true, alt: false, command: false }
      });
      return true;
    } catch {
      return false;
    }
  }
  if (ch1) allOk = await triggerCtrlNumber(1) && allOk;
  if (ch2) allOk = await triggerCtrlNumber(2) && allOk;
  if (ch3) allOk = await triggerCtrlNumber(3) && allOk;
  if (ch4) allOk = await triggerCtrlNumber(4) && allOk;
  return allOk;
}
ipcMain.handle("obs:start-recording", async (_e, args) => {
  try {
    const { preview, ch1, ch2, ch3, ch4 } = args || {};
    const ok = await startRecording(!!preview, !!ch1, !!ch2, !!ch3, !!ch4);
    return ok;
  } catch {
    return false;
  }
});
async function stopRecording() {
  const obs = getObsClient();
  if (!obs) return false;
  let ok = true;
  try {
    await obs.call("StopRecord");
  } catch {
    ok = false;
  }
  try {
    await obs.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_0",
      keyModifiers: { shift: false, control: true, alt: false, command: false }
    });
  } catch {
    ok = false;
  }
  return ok;
}
ipcMain.handle("obs:stop-recording", async () => {
  try {
    const ok = await stopRecording();
    return ok;
  } catch {
    return false;
  }
});
async function pauseRecording() {
  const obs = getObsClient();
  if (!obs) return false;
  let ok = true;
  try {
    await obs.call("ToggleRecordPause");
  } catch {
    ok = false;
  }
  try {
    await obs.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_P",
      keyModifiers: { shift: false, control: true, alt: false, command: false }
    });
  } catch {
    ok = false;
  }
  return ok;
}
ipcMain.handle("obs:pause-recording", async () => {
  try {
    const ok = await pauseRecording();
    return ok;
  } catch {
    return false;
  }
});
async function resumeRecording() {
  const obs = getObsClient();
  if (!obs) return false;
  let ok = true;
  try {
    await obs.call("ResumeRecord");
  } catch {
    ok = false;
  }
  try {
    await obs.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_R",
      keyModifiers: { shift: false, control: true, alt: false, command: false }
    });
  } catch {
    ok = false;
  }
  return ok;
}
ipcMain.handle("obs:resume-recording", async () => {
  try {
    const ok = await resumeRecording();
    return ok;
  } catch {
    return false;
  }
});
function timestamp() {
  const now = /* @__PURE__ */ new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}
async function resolveSceneName(obs, hint, channelIndex) {
  if (typeof hint === "string" && hint.trim()) return hint.trim();
  if (!obs) return null;
  try {
    const list = await obs.call("GetSceneList");
    const scenes = Array.isArray(list == null ? void 0 : list.scenes) ? list.scenes : [];
    const normalized = scenes.map((s) => ({ raw: String((s == null ? void 0 : s.sceneName) ?? ""), low: String((s == null ? void 0 : s.sceneName) ?? "").toLowerCase() }));
    const exactOrder = [
      `channel ${channelIndex}`,
      `ch${channelIndex}`,
      `source ${channelIndex}`
    ];
    for (const cand of exactOrder) {
      const m = normalized.find((s) => s.low === cand);
      if (m) return m.raw;
    }
    const containsOrder = [
      `channel ${channelIndex}`,
      `ch${channelIndex}`,
      `source ${channelIndex}`,
      `${channelIndex}`
    ];
    const cont = normalized.find((s) => containsOrder.some((c) => s.low.includes(c)));
    return cont ? cont.raw : null;
  } catch {
    return null;
  }
}
async function takeSnapshots(payload) {
  const obs = getObsClient();
  if (!obs) return [];
  let outDir = "";
  const preferred = typeof (payload == null ? void 0 : payload.outputDir) === "string" ? payload.outputDir.trim() : "";
  if (preferred) {
    outDir = preferred;
  } else {
    outDir = await getRecordingDirectory();
  }
  try {
    if (outDir && !fs.existsSync(outDir)) {
      await fsp.mkdir(outDir, { recursive: true });
    }
  } catch {
  }
  Math.max(1, Math.min(3840, Math.floor(Number((payload == null ? void 0 : payload.width) ?? 0)) || 0)) || void 0;
  Math.max(1, Math.min(2160, Math.floor(Number((payload == null ? void 0 : payload.height) ?? 0)) || 0)) || void 0;
  const results = [];
  const tasks = [];
  const doOne = async (idx, hint) => {
    const sceneName = await resolveSceneName(obs, hint, idx);
    if (!sceneName) return;
    const filePath = path.join(outDir || process.cwd(), `snapshot_ch${idx}_${timestamp()}.png`);
    try {
      await obs.call("SaveSourceScreenshot", {
        sourceName: sceneName,
        imageFormat: "png",
        imageFilePath: filePath
      });
      results.push(filePath);
    } catch {
    }
  };
  if (payload == null ? void 0 : payload.ch1) tasks.push(doOne(1, payload.ch1));
  if (payload == null ? void 0 : payload.ch2) tasks.push(doOne(2, payload.ch2));
  if (payload == null ? void 0 : payload.ch3) tasks.push(doOne(3, payload.ch3));
  if (payload == null ? void 0 : payload.ch4) tasks.push(doOne(4, payload.ch4));
  await Promise.all(tasks);
  return results;
}
ipcMain.handle("obs:take-snapshot", async (_e, payload) => {
  try {
    const files = await takeSnapshots(payload || {});
    return { ok: true, data: files };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
});
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let splashWin = null;
let overlayEditorWin = null;
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
  try {
    await startBrowserSourceService();
  } catch {
  }
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
  try {
    await stopBrowserSourceService();
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
ipcMain.on("overlay:get-port-sync", (e) => {
  try {
    e.returnValue = OVERLAY_WS_PORT;
  } catch {
    e.returnValue = 3620;
  }
});
ipcMain.handle("window:open-overlay-editor", async () => {
  try {
    if (overlayEditorWin && !overlayEditorWin.isDestroyed()) {
      overlayEditorWin.show();
      overlayEditorWin.focus();
      return true;
    }
    overlayEditorWin = createOverlayEditorWindow();
    overlayEditorWin.on("closed", () => {
      overlayEditorWin = null;
    });
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("overlay-window:minimize", async () => {
  try {
    overlayEditorWin == null ? void 0 : overlayEditorWin.minimize();
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("overlay-window:close", async () => {
  try {
    overlayEditorWin == null ? void 0 : overlayEditorWin.close();
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("window:minimize", async () => {
  try {
    win == null ? void 0 : win.minimize();
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("window:close", async () => {
  try {
    win == null ? void 0 : win.close();
    return true;
  } catch {
    return false;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
