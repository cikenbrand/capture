import { BrowserWindow, ipcMain, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import OBSWebSocket from "obs-websocket-js";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
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
    frame: false,
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
path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "obs-studio",
  "basic",
  "profiles",
  "Default",
  "basic.ini"
);
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
async function createProject(input) {
  const client = await getClient$d();
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
async function createTask(input) {
  const client = await getClient$c();
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
async function getAllTasks(projectId) {
  const client = await getClient$b();
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
async function getSelectedTaskDetails(taskId) {
  const client = await getClient$a();
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
async function editTask(taskId, updates) {
  const client = await getClient$9();
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
async function createDive(input) {
  const client = await getClient$8();
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
async function editDive(diveId, updates) {
  const client = await getClient$7();
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
async function createNode(input) {
  const client = await getClient$6();
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
async function getAllNodes(projectId) {
  const client = await getClient$5();
  const db = client.db("capture");
  const nodesCol = db.collection("nodes");
  const projectObjectId = new ObjectId(projectId);
  const nodes = await nodesCol.find({ projectId: projectObjectId }).sort({ level: 1, createdAt: 1 }).toArray();
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
async function getAllProjects() {
  const client = await getClient$4();
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
async function getAllDives(projectId) {
  const client = await getClient$3();
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
async function getSelectedProjectDetails(projectId) {
  const client = await getClient$2();
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
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return { ok: true, data: plain };
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
async function getSelectedDiveDetails(diveId) {
  const client = await getClient$1();
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
async function editProject(projectId, updates) {
  const client = await getClient();
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
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
    return { ok: true, data: plain };
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
