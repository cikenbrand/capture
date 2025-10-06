import { BrowserWindow as T, ipcMain as i, app as _ } from "electron";
import u from "node:path";
import { pathToFileURL as Ne, fileURLToPath as Fe } from "node:url";
import { spawn as Ee, spawnSync as ke } from "node:child_process";
import I from "node:fs";
import Le from "obs-websocket-js";
import Be from "node:http";
import { MongoClient as m, ServerApiVersion as y, ObjectId as f } from "mongodb";
let A = null;
function Me(e) {
  A = new T({
    width: 360,
    height: 240,
    frame: !1,
    resizable: !1,
    movable: !0,
    show: !1,
    transparent: !1,
    backgroundColor: "#121212",
    alwaysOnTop: !0,
    skipTaskbar: !0
  });
  const t = process.env.VITE_PUBLIC || u.join(process.env.APP_ROOT || process.cwd(), "public"), r = u.join(t, "htmls", "splashscreen.html");
  return A.loadFile(r), A.once("ready-to-show", () => A == null ? void 0 : A.show()), A.timeoutMs = e, A;
}
function U() {
  return process.env.APP_ROOT ? u.join(process.env.APP_ROOT, "dist") : u.join(__dirname, "..", "..", "dist");
}
function Te() {
  return process.env.VITE_DEV_SERVER_URL || "";
}
function He() {
  const e = new T({
    width: 1280,
    height: 800,
    show: !1,
    frame: !1,
    backgroundColor: "#0f0f0f",
    icon: u.join(process.env.VITE_PUBLIC || U(), "electron-vite.svg"),
    webPreferences: {
      preload: u.join(process.env.APP_ROOT || u.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), t = Te();
  return t ? e.loadURL(t) : e.loadFile(u.join(U(), "index.html")), e;
}
function Ve() {
  const e = new T({
    width: 1e3,
    height: 700,
    show: !0,
    frame: !1,
    backgroundColor: "#0f0f0f",
    icon: u.join(process.env.VITE_PUBLIC || U(), "electron-vite.svg"),
    webPreferences: {
      preload: u.join(process.env.APP_ROOT || u.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      webSecurity: !1
    }
  }), t = Te();
  return t ? e.loadURL(`${t}?window=overlay-editor`) : e.loadFile(u.join(U(), "index.html"), { query: { window: "overlay-editor" } }), e;
}
const F = "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe".replace(/\\/g, "\\"), L = "C:\\Program Files\\obs-studio\\bin\\64bit".replace(/\\/g, "\\"), qe = "ws://127.0.0.1:4455", We = ["--startvirtualcam", "--disable-shutdown-check"];
u.join(
  process.env.APPDATA || u.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "obs-studio",
  "basic",
  "profiles",
  "Default",
  "basic.ini"
);
const pe = 3620, g = "mongodb://localhost:27017/capture", Se = 5e3;
function Ye() {
  if (!I.existsSync(F))
    throw new Error(`OBS executable not found at: ${F}`);
  if (!I.existsSync(L))
    throw new Error(`Working directory does not exist: ${L}`);
  const e = Ee(F, We, {
    cwd: L,
    detached: !0,
    stdio: "ignore",
    windowsHide: !0
  });
  return e.unref(), e.pid ?? -1;
}
let C = null;
function v() {
  return C;
}
async function Ge(e = 4e3) {
  try {
    if (C)
      return !0;
    const t = new Le(), r = t.connect(qe), o = new Promise((n, a) => {
      const s = setTimeout(() => {
        clearTimeout(s), a(new Error("OBS connect timeout"));
      }, e);
    });
    return await Promise.race([r, o]), C = t, !0;
  } catch {
    try {
      await (C == null ? void 0 : C.disconnect());
    } catch {
    }
    return C = null, !1;
  }
}
async function Ke() {
  const e = v();
  if (!e) return !1;
  const t = !0, r = 3e3, o = {
    reason: `requested by ${u.basename(process.execPath)}`,
    support_url: "https://github.com/norihiro/obs-shutdown-plugin/issues",
    force: t,
    exit_timeout: 0
  }, n = e.call("CallVendorRequest", {
    vendorName: "obs-shutdown-plugin",
    requestType: "shutdown",
    requestData: o
  }), a = new Promise((s, c) => {
    const l = setTimeout(() => {
      clearTimeout(l), c(new Error("exitOBS timed out"));
    }, r);
  });
  try {
    return await Promise.race([n, a]), !0;
  } catch {
    return !1;
  }
}
function be() {
  try {
    if (process.platform === "win32") {
      const t = (ke("tasklist", [], { encoding: "utf8" }).stdout || "").toLowerCase();
      return t ? t.includes("obs64.exe") || t.includes("obs.exe") : !1;
    }
    return process.platform === "darwin" || process.platform === "linux" ? (ke("ps", ["-A", "-o", "comm="], { encoding: "utf8" }).stdout || "").toLowerCase().split(`
`).some((r) => r.includes("obs")) : !1;
  } catch {
    return !1;
  }
}
async function ze() {
  try {
    const e = v();
    if (!e) return "";
    const t = await e.call("GetCurrentProgramScene"), r = (t == null ? void 0 : t.currentProgramSceneName) ?? "";
    return typeof r == "string" ? r : "";
  } catch {
    return "";
  }
}
i.handle("obs:get-current-scene", async () => {
  try {
    return await ze();
  } catch {
    return "";
  }
});
async function Xe(e) {
  try {
    const t = v();
    return t ? (await t.call("SetCurrentProgramScene", { sceneName: e }), !0) : !1;
  } catch {
    return !1;
  }
}
i.handle("obs:set-current-scene", async (e, t) => {
  try {
    return typeof t != "string" || !t.trim() ? !1 : await Xe(t);
  } catch {
    return !1;
  }
});
let j = null, ge = !1, D = null;
function Je() {
  const e = process.env.APP_ROOT || u.join(__dirname, "..", ".."), t = u.join(e, "drawing-service", "server.js"), r = t.replace(/\.asar(\\|\/)/, ".asar.unpacked$1");
  try {
    return require("fs").existsSync(r) ? r : t;
  } catch {
    return t;
  }
}
function Ie(e, t) {
  const r = Date.now() + t;
  return new Promise((o) => {
    const n = () => {
      try {
        const a = Be.get({ host: "127.0.0.1", port: e, path: "/health", timeout: 1e3 }, (s) => {
          if (s.statusCode && s.statusCode >= 200 && s.statusCode < 300) {
            try {
              s.resume();
            } catch {
            }
            o(!0);
          } else {
            try {
              s.resume();
            } catch {
            }
            if (Date.now() >= r) return o(!1);
            setTimeout(n, 300);
          }
        });
        a.on("error", () => {
          if (Date.now() >= r) return o(!1);
          setTimeout(n, 300);
        }), a.on("timeout", () => {
          try {
            a.destroy();
          } catch {
          }
          if (Date.now() >= r) return o(!1);
          setTimeout(n, 300);
        });
      } catch {
        if (Date.now() >= r) return o(!1);
        setTimeout(n, 300);
      }
    };
    n();
  });
}
async function Qe(e) {
  try {
    if (j || ge) return !0;
    const t = Number(e || pe || 3620) || 3620, r = Je();
    let o = "";
    try {
      o = u.join(_.getPath("userData"), "overlay-images");
    } catch {
      o = "";
    }
    process.env.OVERLAY_WS_PORT = String(t), process.env.OVERLAY_IMAGES_DIR = o;
    try {
      if (await import(Ne(r).href), ge = !0, D = t, !await Ie(t, 5e3))
        try {
          console.warn("[browser-source-service] did not become healthy in time");
        } catch {
        }
      return !0;
    } catch {
      const a = process.execPath;
      if (j = Ee(a, [r], {
        cwd: u.dirname(r),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", OVERLAY_WS_PORT: String(t), OVERLAY_IMAGES_DIR: o },
        stdio: "ignore",
        detached: !1
      }), j.on("exit", (l, d) => {
        try {
          console.log(`[browser-source-service] exited code=${l} signal=${d}`);
        } catch {
        }
        j = null, D = null;
      }), D = t, !await Ie(t, 5e3))
        try {
          console.warn("[browser-source-service] did not become healthy in time");
        } catch {
        }
      return !0;
    }
  } catch (t) {
    try {
      console.error("[browser-source-service] failed to start:", t);
    } catch {
    }
    return !1;
  }
}
async function Ze() {
  try {
    const e = j;
    if (j = null, D = null, ge = !1, !e) return;
    try {
      e.kill();
    } catch {
    }
  } catch {
  }
}
let B = null;
async function et() {
  if (B) return B;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), B = e, e;
}
async function tt(e) {
  const o = (await et()).db("capture").collection("projects"), n = /* @__PURE__ */ new Date(), a = {
    name: e.name.trim(),
    client: e.client.trim(),
    contractor: e.contractor.trim(),
    vessel: e.vessel.trim(),
    location: e.location.trim(),
    projectType: e.projectType,
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
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(a)).insertedId, ...a };
}
i.handle("db:createProject", async (e, t) => {
  var r, o;
  try {
    const n = await tt(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let M = null;
async function rt() {
  if (M) return M;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), M = e, e;
}
async function nt(e) {
  const o = (await rt()).db("capture").collection("overlays"), n = /* @__PURE__ */ new Date(), a = e.name.trim();
  if (!a) throw new Error("Overlay name is required");
  const s = (h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (await o.findOne({ name: { $regex: `^${s(a)}$`, $options: "i" } })) throw new Error("An overlay with this name already exists");
  const l = {
    name: a,
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(l)).insertedId, ...l };
}
i.handle("db:createOverlay", async (e, t) => {
  var r, o, n, a;
  try {
    const s = await nt(t), c = ((o = (r = s == null ? void 0 : s._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? s;
    try {
      const l = { id: c, action: "created", name: ((a = (n = t == null ? void 0 : t.name) == null ? void 0 : n.trim) == null ? void 0 : a.call(n)) || "" };
      for (const d of T.getAllWindows())
        try {
          d.webContents.send("overlays:changed", l);
        } catch {
        }
    } catch {
    }
    return { ok: !0, data: c };
  } catch (s) {
    return { ok: !1, error: s instanceof Error ? s.message : "Unknown error" };
  }
});
let H = null;
async function ot() {
  if (H) return H;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), H = e, e;
}
async function at() {
  return (await ot()).db("capture").collection("overlays").find({}).sort({ createdAt: -1 }).toArray();
}
i.handle("db:getAllOverlay", async () => {
  try {
    return { ok: !0, data: (await at()).map((r) => ({
      _id: r._id.toString(),
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })) };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let V = null;
async function st() {
  if (V) return V;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), V = e, e;
}
async function ct(e) {
  const o = (await st()).db("capture").collection("tasks"), n = /* @__PURE__ */ new Date(), a = typeof e.remarks == "string" ? e.remarks.trim() : void 0, s = e.name.trim();
  if (!s)
    throw new Error("Task name is required");
  if (await o.findOne({
    projectId: new f(e.projectId),
    name: { $regex: `^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  }))
    throw new Error("A task with this name already exists in this project");
  const l = {
    projectId: new f(e.projectId),
    name: s,
    ...a ? { remarks: a } : {},
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(l)).insertedId, ...l };
}
i.handle("db:createTask", async (e, t) => {
  var r, o;
  try {
    const n = await ct(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let q = null;
async function it() {
  if (q) return q;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), q = e, e;
}
async function lt(e) {
  return (await it()).db("capture").collection("tasks").find({ projectId: new f(e) }).sort({ createdAt: -1 }).toArray();
}
i.handle("db:getAllTasks", async (e, t) => {
  try {
    return !t || typeof t != "string" ? { ok: !1, error: "projectId is required" } : { ok: !0, data: (await lt(t)).map((n) => {
      var a, s, c, l;
      return {
        _id: ((s = (a = n._id) == null ? void 0 : a.toString) == null ? void 0 : s.call(a)) ?? n._id,
        projectId: ((l = (c = n.projectId) == null ? void 0 : c.toString) == null ? void 0 : l.call(c)) ?? n.projectId,
        name: n.name,
        remarks: n.remarks,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      };
    }) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let W = null;
async function dt() {
  if (W) return W;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), W = e, e;
}
async function ut(e) {
  const o = (await dt()).db("capture").collection("tasks"), n = new f(e);
  return await o.findOne({ _id: n });
}
i.handle("db:getSelectedTaskDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid taskId" };
    const r = await ut(t);
    return r ? { ok: !0, data: {
      _id: r._id.toString(),
      projectId: r.projectId.toString(),
      name: r.name,
      remarks: r.remarks ?? void 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } } : { ok: !0, data: null };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let Y = null;
async function ft() {
  if (Y) return Y;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Y = e, e;
}
async function mt(e, t) {
  const n = (await ft()).db("capture").collection("tasks"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
  typeof t.name == "string" && (c.name = t.name.trim()), typeof t.remarks == "string" && (c.remarks = t.remarks.trim());
  const l = await n.findOneAndUpdate(
    { _id: a },
    { $set: c },
    { returnDocument: "after", includeResultMetadata: !1 }
  );
  if (!l)
    throw new Error("Task not found");
  return l;
}
i.handle("db:editTask", async (e, t, r) => {
  try {
    return { ok: !0, data: await mt(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let G = null;
async function yt() {
  if (G) return G;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), G = e, e;
}
async function gt(e) {
  const o = (await yt()).db("capture").collection("dives"), n = /* @__PURE__ */ new Date(), a = typeof e.remarks == "string" ? e.remarks.trim() : void 0, s = e.name.trim();
  if (!s)
    throw new Error("Dive name is required");
  if (await o.findOne({
    projectId: new f(e.projectId),
    name: { $regex: `^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  }))
    throw new Error("A dive with this name already exists in this project");
  const l = {
    projectId: new f(e.projectId),
    name: s,
    ...a ? { remarks: a } : {},
    started: !1,
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(l)).insertedId, ...l };
}
i.handle("db:createDive", async (e, t) => {
  var r, o;
  try {
    const n = await gt(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let K = null;
async function ht() {
  if (K) return K;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), K = e, e;
}
async function wt(e) {
  const r = (await ht()).db("capture"), o = r.collection("sessions"), n = /* @__PURE__ */ new Date();
  if (![e.preview, e.ch1, e.ch2, e.ch3, e.ch4].some((S) => typeof S == "string" && S.trim().length > 0))
    throw new Error("At least one of preview/ch1/ch2/ch3/ch4 must be provided");
  const s = typeof e.nodeId == "string" && e.nodeId.trim() ? new f(e.nodeId.trim()) : null, c = new f(e.diveId), l = new f(e.taskId), [d, h] = await Promise.all([
    r.collection("dives").findOne({ _id: c }, { projection: { name: 1 } }),
    r.collection("tasks").findOne({ _id: l }, { projection: { name: 1 } })
  ]);
  let w = [];
  if (s) {
    const S = r.collection("nodes"), $ = [];
    let P = s;
    for (; P; ) {
      const N = await S.findOne({ _id: P }, { projection: { name: 1, parentId: 1 } });
      if (!N) break;
      $.push({ id: P, name: String(N.name || "") });
      const ve = N.parentId;
      if (!ve) break;
      P = ve;
    }
    w = $.reverse();
  }
  let b;
  if (w.length > 0)
    for (let S = w.length - 1; S >= 0; S--) {
      const $ = w[S];
      b ? b = { id: w[S].id, name: w[S].name, children: b } : b = { id: $.id, name: $.name };
    }
  const R = {
    projectId: new f(e.projectId),
    diveId: c,
    taskId: l,
    dive: { id: c, name: String((d == null ? void 0 : d.name) || "") },
    task: { id: l, name: String((h == null ? void 0 : h.name) || "") },
    ...b ? { nodesHierarchy: b } : {},
    ...e.preview && e.preview.trim() ? { preview: e.preview.trim() } : {},
    ...e.ch1 && e.ch1.trim() ? { ch1: e.ch1.trim() } : {},
    ...e.ch2 && e.ch2.trim() ? { ch2: e.ch2.trim() } : {},
    ...e.ch3 && e.ch3.trim() ? { ch3: e.ch3.trim() } : {},
    ...e.ch4 && e.ch4.trim() ? { ch4: e.ch4.trim() } : {},
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(R)).insertedId, ...R };
}
i.handle("db:createSession", async (e, t) => {
  var r, o;
  try {
    const n = await wt(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let z = null;
async function pt() {
  if (z) return z;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), z = e, e;
}
async function vt(e, t) {
  const n = (await pt()).db("capture").collection("dives"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
  typeof t.name == "string" && (c.name = t.name.trim()), typeof t.remarks == "string" && (c.remarks = t.remarks.trim()), typeof t.started == "boolean" && (c.started = t.started);
  const l = await n.findOneAndUpdate(
    { _id: a },
    { $set: c },
    { returnDocument: "after", includeResultMetadata: !1 }
  );
  if (!l)
    throw new Error("Dive not found");
  return l;
}
i.handle("db:editDive", async (e, t, r) => {
  try {
    return { ok: !0, data: await vt(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let X = null;
async function kt() {
  if (X) return X;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), X = e, e;
}
async function St(e) {
  const o = (await kt()).db("capture").collection("nodes"), n = /* @__PURE__ */ new Date(), a = new f(e.projectId);
  let s = 0, c;
  if (e.parentId) {
    c = new f(e.parentId);
    const w = await o.findOne({ _id: c });
    if (!w) throw new Error("Parent node not found");
    if (!w.projectId.equals(a))
      throw new Error("Parent node belongs to a different project");
    s = (w.level ?? 0) + 1;
  }
  const l = typeof e.remarks == "string" ? e.remarks.trim() : void 0, d = {
    projectId: a,
    name: e.name.trim(),
    ...c ? { parentId: c } : {},
    ...l ? { remarks: l } : {},
    level: s,
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(d)).insertedId, ...d };
}
i.handle("db:createNode", async (e, t) => {
  try {
    return { ok: !0, data: await St(t) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let J = null;
async function bt() {
  if (J) return J;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), J = e, e;
}
async function It(e, t) {
  const n = (await bt()).db("capture").collection("nodes"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
  typeof t.name == "string" && (c.name = t.name.trim()), typeof t.remarks == "string" && (c.remarks = t.remarks.trim());
  const l = await n.findOneAndUpdate(
    { _id: a },
    { $set: c },
    { returnDocument: "after", includeResultMetadata: !1 }
  );
  if (!l)
    throw new Error("Node not found");
  return l;
}
i.handle("db:editNode", async (e, t, r) => {
  try {
    return { ok: !0, data: await It(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let Q = null;
async function _t() {
  if (Q) return Q;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Q = e, e;
}
async function At(e) {
  const o = (await _t()).db("capture").collection("nodes"), n = new f(e), a = await o.find({ projectId: n }).sort({ level: 1, createdAt: 1, name: 1 }).toArray(), s = /* @__PURE__ */ new Map(), c = [];
  for (const l of a)
    s.set(l._id.toHexString(), { ...l, children: [] });
  for (const l of a) {
    const d = s.get(l._id.toHexString());
    if (l.parentId) {
      const h = s.get(l.parentId.toHexString());
      h ? h.children.push(d) : c.push(d);
    } else
      c.push(d);
  }
  return c;
}
i.handle("db:getAllNodes", async (e, t) => {
  try {
    const r = await At(t), o = (n) => {
      var a, s, c, l, d, h;
      return {
        _id: ((s = (a = n._id) == null ? void 0 : a.toString) == null ? void 0 : s.call(a)) ?? n._id,
        projectId: ((l = (c = n.projectId) == null ? void 0 : c.toString) == null ? void 0 : l.call(c)) ?? n.projectId,
        parentId: n.parentId ? ((h = (d = n.parentId).toString) == null ? void 0 : h.call(d)) ?? n.parentId : void 0,
        name: n.name,
        level: n.level,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        children: Array.isArray(n.children) ? n.children.map(o) : []
      };
    };
    return { ok: !0, data: r.map(o) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let Z = null;
async function Ot() {
  if (Z) return Z;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Z = e, e;
}
async function Ct(e) {
  const o = (await Ot()).db("capture").collection("nodes"), n = new f(e), a = /* @__PURE__ */ new Set([n.toHexString()]);
  let s = [n];
  for (; s.length; ) {
    const d = await o.find({ parentId: { $in: s } }, { projection: { _id: 1 } }).toArray(), h = [];
    for (const w of d) {
      const b = w._id.toHexString();
      a.has(b) || (a.add(b), h.push(w._id));
    }
    s = h;
  }
  const c = Array.from(a).map((d) => new f(d));
  return (await o.deleteMany({ _id: { $in: c } })).deletedCount ?? 0;
}
i.handle("db:deleteNode", async (e, t) => {
  try {
    return { ok: !0, data: { deletedCount: await Ct(t) } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ee = null;
async function Et() {
  if (ee) return ee;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ee = e, e;
}
async function Tt(e) {
  const o = (await Et()).db("capture").collection("nodes"), n = new f(e);
  return await o.findOne({ _id: n });
}
i.handle("db:getSelectedNodeDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid nodeId" };
    const r = await Tt(t);
    return r ? { ok: !0, data: {
      _id: r._id.toString(),
      projectId: r.projectId.toString(),
      parentId: r.parentId ? r.parentId.toString() : void 0,
      name: r.name,
      remarks: r.remarks ?? void 0,
      level: r.level,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } } : { ok: !0, data: null };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let te = null;
async function jt() {
  if (te) return te;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), te = e, e;
}
async function $t() {
  return (await jt()).db("capture").collection("projects").find({}).sort({ createdAt: -1 }).toArray();
}
i.handle("db:getAllProjects", async () => {
  try {
    return { ok: !0, data: (await $t()).map((r) => ({
      _id: r._id.toString(),
      name: r.name,
      client: r.client,
      contractor: r.contractor,
      vessel: r.vessel,
      location: r.location,
      projectType: r.projectType,
      lastSelectedDiveId: r.lastSelectedDiveId ?? null,
      lastSelectedTaskId: r.lastSelectedTaskId ?? null,
      lastSelectedNodeId: r.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: r.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: r.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: r.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: r.lastSelectedOverlayCh4Id ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })) };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let je = null;
function Pt(e) {
  je = e && e.trim() || null;
}
function Dt() {
  return je;
}
i.handle("app:setSelectedProjectId", async (e, t) => {
  try {
    return Pt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedProjectId", async () => {
  try {
    return { ok: !0, data: Dt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let $e = null;
function Ut(e) {
  $e = e && e.trim() || null;
}
function Rt() {
  return $e;
}
i.handle("app:setSelectedDiveId", async (e, t) => {
  try {
    return Ut(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedDiveId", async () => {
  try {
    return { ok: !0, data: Rt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let E = null;
function xt() {
  return E;
}
function Nt(e, t) {
  t ? E = e && e.trim() || null : E && e && E === e.trim() ? E = null : e || (E = null);
}
i.handle("dive:getStartedDiveId", async () => {
  try {
    return { ok: !0, data: xt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
i.handle("dive:isStarted", async (e, t) => {
  try {
    const r = typeof t == "string" && t.trim() || null;
    return { ok: !0, data: !!(r && E === r) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("dive:setStarted", async (e, t, r) => {
  try {
    return Nt(typeof t == "string" ? t : null, !!r), { ok: !0 };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let Pe = null;
function Ft(e) {
  Pe = e && e.trim() || null;
}
function Lt() {
  return Pe;
}
i.handle("app:setSelectedTaskId", async (e, t) => {
  try {
    return Ft(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedTaskId", async () => {
  try {
    return { ok: !0, data: Lt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let De = null;
function Bt(e) {
  De = e && e.trim() || null;
}
function Mt() {
  return De;
}
i.handle("app:setSelectedNodeId", async (e, t) => {
  try {
    return Bt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedNodeId", async () => {
  try {
    return { ok: !0, data: Mt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let re = null;
async function Ht() {
  if (re) return re;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), re = e, e;
}
async function Vt(e) {
  return (await Ht()).db("capture").collection("dives").find({ projectId: new f(e) }).sort({ createdAt: -1 }).toArray();
}
i.handle("db:getAllDives", async (e, t) => {
  try {
    return !t || typeof t != "string" ? { ok: !1, error: "projectId is required" } : { ok: !0, data: (await Vt(t)).map((n) => {
      var a, s, c, l;
      return {
        _id: ((s = (a = n._id) == null ? void 0 : a.toString) == null ? void 0 : s.call(a)) ?? n._id,
        projectId: ((l = (c = n.projectId) == null ? void 0 : c.toString) == null ? void 0 : l.call(c)) ?? n.projectId,
        name: n.name,
        remarks: n.remarks,
        started: !!n.started,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      };
    }) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ne = null;
async function qt() {
  if (ne) return ne;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ne = e, e;
}
async function Wt(e) {
  const o = (await qt()).db("capture").collection("projects"), n = new f(e);
  return await o.findOne({ _id: n });
}
i.handle("db:getSelectedProjectDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid projectId" };
    const r = await Wt(t);
    return r ? { ok: !0, data: {
      _id: r._id.toString(),
      name: r.name,
      client: r.client,
      contractor: r.contractor,
      vessel: r.vessel,
      location: r.location,
      projectType: r.projectType,
      lastSelectedDiveId: r.lastSelectedDiveId ?? null,
      lastSelectedTaskId: r.lastSelectedTaskId ?? null,
      lastSelectedNodeId: r.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: r.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: r.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: r.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: r.lastSelectedOverlayCh4Id ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } } : { ok: !0, data: null };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let oe = null;
async function Yt() {
  if (oe) return oe;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), oe = e, e;
}
async function Gt(e) {
  const o = (await Yt()).db("capture").collection("dives"), n = new f(e);
  return await o.findOne({ _id: n });
}
i.handle("db:getSelectedDiveDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid diveId" };
    const r = await Gt(t);
    return r ? { ok: !0, data: {
      _id: r._id.toString(),
      projectId: r.projectId.toString(),
      name: r.name,
      remarks: r.remarks ?? void 0,
      started: !!r.started,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    } } : { ok: !0, data: null };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ae = null;
async function Kt() {
  if (ae) return ae;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ae = e, e;
}
async function zt(e, t) {
  const n = (await Kt()).db("capture").collection("projects"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
  if (typeof t.name == "string" && (c.name = t.name.trim()), typeof t.client == "string" && (c.client = t.client.trim()), typeof t.contractor == "string" && (c.contractor = t.contractor.trim()), typeof t.vessel == "string" && (c.vessel = t.vessel.trim()), typeof t.location == "string" && (c.location = t.location.trim()), t.hasOwnProperty("lastSelectedDiveId")) {
    const d = t.lastSelectedDiveId;
    c.lastSelectedDiveId = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedTaskId")) {
    const d = t.lastSelectedTaskId;
    c.lastSelectedTaskId = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedNodeId")) {
    const d = t.lastSelectedNodeId;
    c.lastSelectedNodeId = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh1Id")) {
    const d = t.lastSelectedOverlayCh1Id;
    c.lastSelectedOverlayCh1Id = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh2Id")) {
    const d = t.lastSelectedOverlayCh2Id;
    c.lastSelectedOverlayCh2Id = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh3Id")) {
    const d = t.lastSelectedOverlayCh3Id;
    c.lastSelectedOverlayCh3Id = typeof d == "string" && d.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh4Id")) {
    const d = t.lastSelectedOverlayCh4Id;
    c.lastSelectedOverlayCh4Id = typeof d == "string" && d.trim() || null;
  }
  const l = await n.findOneAndUpdate(
    { _id: a },
    { $set: c },
    { returnDocument: "after", includeResultMetadata: !1 }
  );
  if (!l)
    throw new Error("Project not found");
  return l;
}
i.handle("db:editProject", async (e, t, r) => {
  try {
    const o = await zt(t, r);
    return { ok: !0, data: {
      _id: o._id.toString(),
      name: o.name,
      client: o.client,
      contractor: o.contractor,
      vessel: o.vessel,
      location: o.location,
      projectType: o.projectType,
      lastSelectedDiveId: o.lastSelectedDiveId ?? null,
      lastSelectedTaskId: o.lastSelectedTaskId ?? null,
      lastSelectedNodeId: o.lastSelectedNodeId ?? null,
      lastSelectedOverlayCh1Id: o.lastSelectedOverlayCh1Id ?? null,
      lastSelectedOverlayCh2Id: o.lastSelectedOverlayCh2Id ?? null,
      lastSelectedOverlayCh3Id: o.lastSelectedOverlayCh3Id ?? null,
      lastSelectedOverlayCh4Id: o.lastSelectedOverlayCh4Id ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    } };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let Ue = null;
function Xt(e) {
  Ue = e;
}
function Jt() {
  return Ue;
}
i.handle("app:setSelectedDrawingTool", async (e, t) => {
  try {
    return Xt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedDrawingTool", async () => {
  try {
    return { ok: !0, data: Jt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let Re = null;
function Qt(e) {
  Re = e && e.trim() || null;
}
function Zt() {
  return Re;
}
i.handle("app:setSelectedOverlayLayerId", async (e, t) => {
  try {
    return Qt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedOverlayLayerId", async () => {
  try {
    return { ok: !0, data: Zt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let he = [];
function er(e) {
  if (!e || !Array.isArray(e)) {
    he = [];
    return;
  }
  const t = e.map((r) => typeof r == "string" ? r.trim() : "").filter((r) => !!r);
  he = Array.from(new Set(t));
}
function tr() {
  return [...he];
}
i.handle("app:setSelectedOverlayComponentIds", async (e, t) => {
  try {
    return er(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
i.handle("app:getSelectedOverlayComponentIds", async () => {
  try {
    return { ok: !0, data: tr() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let se = null;
async function rr() {
  if (se) return se;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), se = e, e;
}
async function nr(e, t) {
  const n = (await rr()).db("capture").collection("overlays"), a = new f(e), s = /* @__PURE__ */ new Date(), c = t.trim();
  if (!c) throw new Error("Overlay name is required");
  const l = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (await n.findOne({ _id: { $ne: a }, name: { $regex: `^${l(c)}$`, $options: "i" } })) throw new Error("An overlay with this name already exists");
  return await n.updateOne({ _id: a }, { $set: { name: c, updatedAt: s } }), await n.findOne({ _id: a });
}
i.handle("db:renameOverlay", async (e, t) => {
  var r, o;
  try {
    if (!(t != null && t.id) || !(t != null && t.name) || !t.name.trim()) throw new Error("Invalid input");
    const n = await nr(t.id, t.name), a = ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? t.id;
    try {
      const s = { id: a, name: t.name, action: "renamed" };
      for (const c of T.getAllWindows())
        try {
          c.webContents.send("overlays:changed", s);
        } catch {
        }
    } catch {
    }
    return { ok: !0, data: a };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let ce = null;
async function or() {
  if (ce) return ce;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ce = e, e;
}
async function ar(e) {
  const o = (await or()).db("capture").collection("overlays"), n = new f(e);
  return (await o.deleteOne({ _id: n })).deletedCount === 1;
}
i.handle("db:deleteOverlay", async (e, t) => {
  try {
    if (!(t != null && t.id)) throw new Error("Invalid id");
    if (!await ar(t.id)) throw new Error("Overlay not found");
    try {
      const o = { id: t.id, action: "deleted" };
      for (const n of T.getAllWindows())
        try {
          n.webContents.send("overlays:changed", o);
        } catch {
        }
    } catch {
    }
    return { ok: !0, data: t.id };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ie = null;
async function sr() {
  if (ie) return ie;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ie = e, e;
}
async function cr(e) {
  if (!(e != null && e.overlayId)) throw new Error("overlayId is required");
  if (!(e != null && e.type)) throw new Error("type is required");
  const t = new f(e.overlayId), r = e.type !== "image", o = r ? {
    fontFamily: "Inter, ui-sans-serif, system-ui",
    fontSize: 16,
    fontWeight: "normal",
    color: "#FFFFFF",
    align: "left",
    letterSpacing: 0,
    lineHeight: 1.2,
    italic: !1,
    underline: !1,
    uppercase: !1
  } : void 0;
  let n = {};
  switch (e.type) {
    case "custom-text":
      n.customText = e.customText ?? "Text";
      break;
    case "date":
      n.dateFormat = e.dateFormat ?? "YYYY-MM-DD";
      break;
    case "time":
      n.twentyFourHour = e.twentyFourHour ?? !0, n.useUTC = e.useUTC ?? !1;
      break;
    case "data":
      n.dataType = e.dataType ?? "string";
      break;
    case "node":
      n.nodeLevel = e.nodeLevel ?? 1;
      break;
    case "image":
      n.imagePath = e.imagePath ?? "";
      break;
  }
  const c = (await sr()).db("capture").collection("overlay_components"), l = await c.countDocuments({ overlayId: t }), d = `${e.type}-${l + 1}`, x = {
    overlayId: t,
    name: e.name && e.name.trim() ? e.name.trim() : d,
    type: e.type,
    x: Number.isFinite(Number(e.x)) ? Number(e.x) : 100,
    y: Number.isFinite(Number(e.y)) ? Number(e.y) : 100,
    width: Math.max(1, Number.isFinite(Number(e.width)) ? Number(e.width) : 320),
    height: Math.max(1, Number.isFinite(Number(e.height)) ? Number(e.height) : 64),
    backgroundColor: e.backgroundColor ?? "transparent",
    borderColor: e.borderColor ?? "transparent",
    radius: typeof e.radius == "number" ? e.radius : 0,
    textStyle: r ? { ...o, ...e.textStyle ?? {} } : void 0,
    ...n,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
  return { _id: (await c.insertOne(x)).insertedId, ...x };
}
i.handle("db:createOverlayComponent", async (e, t) => {
  var r, o;
  try {
    const n = await cr(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let le = null;
async function ir() {
  if (le) return le;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), le = e, e;
}
async function lr(e) {
  const o = (await ir()).db("capture").collection("overlay_components"), n = e ? { overlayId: new f(e) } : {};
  return o.find(n, { projection: { _id: 1, name: 1 } }).sort({ createdAt: -1 }).toArray();
}
i.handle("db:getAllOverlayComponents", async (e, t) => {
  try {
    return { ok: !0, data: (await lr(t == null ? void 0 : t.overlayId)).map((n) => ({ _id: n._id.toString(), name: n.name })) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let de = null;
async function dr() {
  if (de) return de;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), de = e, e;
}
function ur(e) {
  const t = { updatedAt: /* @__PURE__ */ new Date() };
  return typeof e.overlayId == "string" && e.overlayId.trim() && (t.overlayId = new f(e.overlayId)), typeof e.name == "string" && (t.name = e.name.trim()), typeof e.type == "string" && (t.type = e.type), typeof e.x == "number" && (t.x = e.x), typeof e.y == "number" && (t.y = e.y), typeof e.width == "number" && (t.width = Math.max(1, e.width)), typeof e.height == "number" && (t.height = Math.max(1, e.height)), typeof e.backgroundColor == "string" && (t.backgroundColor = e.backgroundColor), typeof e.borderColor == "string" && (t.borderColor = e.borderColor), typeof e.radius == "number" && (t.radius = e.radius), typeof e.textStyle == "object" && e.textStyle && (t.textStyle = e.textStyle), typeof e.customText == "string" && (t.customText = e.customText), typeof e.dateFormat == "string" && (t.dateFormat = e.dateFormat), typeof e.twentyFourHour == "boolean" && (t.twentyFourHour = e.twentyFourHour), typeof e.useUTC == "boolean" && (t.useUTC = e.useUTC), typeof e.dataType == "string" && (t.dataType = e.dataType), typeof e.nodeLevel == "number" && (t.nodeLevel = e.nodeLevel), typeof e.imagePath == "string" && (t.imagePath = e.imagePath), t;
}
async function fr(e, t) {
  const n = (await dr()).db("capture").collection("overlay_components"), a = Array.from(new Set((e || []).map((d) => typeof d == "string" ? d.trim() : "").filter(Boolean)));
  if (!a.length) return 0;
  const s = a.map((d) => new f(d)), c = ur(t);
  return (await n.updateMany({ _id: { $in: s } }, { $set: c })).modifiedCount ?? 0;
}
i.handle("db:editOverlayComponent", async (e, t) => {
  try {
    if (!t || !Array.isArray(t.ids) || !t.updates || typeof t.updates != "object") throw new Error("Invalid input");
    const r = await fr(t.ids, t.updates);
    if (r === 0) throw new Error("Overlay component(s) not found");
    return { ok: !0, data: { ids: t.ids, modified: r } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ue = null;
async function mr() {
  if (ue) return ue;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ue = e, e;
}
async function yr(e) {
  const t = Array.from(new Set((e || []).map((c) => typeof c == "string" ? c.trim() : "").filter(Boolean)));
  if (!t.length) return 0;
  const n = (await mr()).db("capture").collection("overlay_components"), a = t.map((c) => new f(c));
  return (await n.deleteMany({ _id: { $in: a } })).deletedCount ?? 0;
}
i.handle("db:deleteOverlayComponent", async (e, t) => {
  try {
    if (!t || !Array.isArray(t.ids)) throw new Error("Invalid ids");
    const r = await yr(t.ids);
    return { ok: !0, data: { ids: t.ids, deleted: r } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let fe = null;
async function gr() {
  if (fe) return fe;
  const e = new m(g, {
    serverApi: {
      version: y.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), fe = e, e;
}
async function hr(e) {
  const o = (await gr()).db("capture").collection("overlay_components"), n = { overlayId: new f(e) }, a = {
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
  return await o.find(n, { projection: a }).sort({ createdAt: 1 }).toArray();
}
i.handle("db:getOverlayComponentsForRender", async (e, t) => {
  try {
    if (!(t != null && t.overlayId)) throw new Error("overlayId is required");
    return { ok: !0, data: (await hr(t.overlayId)).map((n) => ({
      _id: n._id.toString(),
      name: n.name,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      backgroundColor: n.backgroundColor,
      borderColor: n.borderColor,
      radius: n.radius,
      textStyle: n.textStyle,
      customText: n.customText,
      dateFormat: n.dateFormat,
      twentyFourHour: n.twentyFourHour,
      useUTC: n.useUTC,
      dataType: n.dataType,
      nodeLevel: n.nodeLevel,
      imagePath: n.imagePath,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    })) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
function wr() {
  if (process.platform !== "win32")
    throw new Error("This application supports Windows only");
  const e = _.getPath("userData"), t = u.join(e, "overlay-images");
  try {
    I.mkdirSync(t, { recursive: !0 });
  } catch {
  }
  return t;
}
function pr(e) {
  const t = e.toLowerCase();
  return t === ".png" || t === ".jpg" || t === ".jpeg" || t === ".webp" || t === ".bmp";
}
function _e(e) {
  const t = u.extname(e || "").toLowerCase();
  if (!pr(t)) throw new Error("Unsupported image type");
  const o = u.basename(e, t).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "image", n = /* @__PURE__ */ new Date(), a = n.getFullYear(), s = String(n.getMonth() + 1).padStart(2, "0"), c = String(n.getDate()).padStart(2, "0"), l = String(n.getHours()).padStart(2, "0"), d = String(n.getMinutes()).padStart(2, "0"), h = String(n.getSeconds()).padStart(2, "0");
  return `${o}_${a}${s}${c}_${l}${d}${h}${t}`;
}
async function vr(e) {
  if (!e || typeof e != "object") throw new Error("Invalid input");
  const t = wr();
  if (e.sourcePath) {
    const r = u.resolve(e.sourcePath);
    if (!I.statSync(r).isFile()) throw new Error("Source is not a file");
    const n = _e(u.basename(r)), a = u.join(t, n);
    I.copyFileSync(r, a);
    const s = `file://${a.replace(/\\/g, "/")}`, c = Ae(n);
    return { absolutePath: a, fileUrl: s, httpUrl: c, filename: n };
  }
  if (e.bytesBase64) {
    const r = e.filename && e.filename.trim() ? e.filename.trim() : "image.png", o = _e(r), n = u.join(t, o), a = Buffer.from(e.bytesBase64, "base64");
    I.writeFileSync(n, a);
    const s = `file://${n.replace(/\\/g, "/")}`, c = Ae(o);
    return { absolutePath: n, fileUrl: s, httpUrl: c, filename: o };
  }
  throw new Error("Provide either sourcePath or bytesBase64");
}
function Ae(e) {
  try {
    return `http://127.0.0.1:${Number(process.env.OVERLAY_WS_PORT || pe || 3620) || 3620}/images/${encodeURIComponent(e)}`;
  } catch {
    return "";
  }
}
i.handle("fs:uploadOverlayImage", async (e, t) => {
  try {
    return { ok: !0, data: await vr(t) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
function kr() {
  if (process.platform !== "win32")
    throw new Error("This application supports Windows only");
  const e = _.getPath("userData"), t = u.join(e, "overlay-images");
  try {
    I.mkdirSync(t, { recursive: !0 });
  } catch {
  }
  return t;
}
function Sr(e) {
  const t = e.toLowerCase();
  return t === ".png" || t === ".jpg" || t === ".jpeg" || t === ".webp" || t === ".bmp";
}
function br(e) {
  return `file://${e.replace(/\\/g, "/")}`;
}
function Ir(e) {
  try {
    return `http://127.0.0.1:${Number(process.env.OVERLAY_WS_PORT || 3620) || 3620}/images/${encodeURIComponent(e)}`;
  } catch {
    return "";
  }
}
function _r() {
  const e = kr();
  let t = [];
  try {
    const r = I.readdirSync(e);
    for (const o of r)
      try {
        const n = u.extname(o);
        if (!Sr(n)) continue;
        const a = u.join(e, o), s = I.statSync(a);
        if (!s.isFile()) continue;
        t.push({
          absolutePath: a,
          fileUrl: br(a),
          httpUrl: Ir(o),
          filename: o,
          size: s.size,
          modifiedAt: new Date(s.mtimeMs).toISOString()
        });
      } catch {
      }
  } catch {
  }
  return t.sort((r, o) => r.modifiedAt < o.modifiedAt ? 1 : r.modifiedAt > o.modifiedAt ? -1 : 0), t;
}
i.handle("fs:getAllOverlayImages", async () => {
  try {
    return { ok: !0, data: _r() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
const Ar = "video sources", Oe = "source 1", me = "video capture device 1";
async function Or() {
  const e = v();
  if (!e) return [];
  try {
    try {
      const o = await e.call("GetGroupSceneItemList", { groupName: Oe });
      if (!(Array.isArray(o == null ? void 0 : o.sceneItems) ? o.sceneItems.some((a) => String((a == null ? void 0 : a.sourceName) ?? "").toLowerCase() === me) : !1))
        try {
          const a = await e.call("GetSceneItemList", { sceneName: Ar }), s = Array.isArray(a == null ? void 0 : a.sceneItems) ? a.sceneItems.some((c) => String((c == null ? void 0 : c.sourceName) ?? "").toLowerCase() === Oe) : !1;
        } catch {
        }
    } catch {
    }
    try {
      const o = await e.call("GetInputList"), n = (Array.isArray(o == null ? void 0 : o.inputs) ? o.inputs : []).find((a) => String((a == null ? void 0 : a.inputName) ?? "").toLowerCase() === me);
    } catch {
    }
    const t = [];
    return await (async (o) => {
      try {
        const n = await e.call("GetInputPropertiesListPropertyItems", {
          inputName: me,
          propertyName: o
        }), a = Array.isArray(n == null ? void 0 : n.propertyItems) ? n.propertyItems : [];
        for (const s of a) {
          const c = String((s == null ? void 0 : s.itemName) ?? (s == null ? void 0 : s.name) ?? "").trim(), l = String((s == null ? void 0 : s.itemValue) ?? (s == null ? void 0 : s.value) ?? "").trim();
          c && l && !t.some((d) => d.id === l) && t.push({ id: l, name: c });
        }
      } catch {
      }
    })("video_device_id"), t.filter((o) => !/obs/i.test(o.name));
  } catch {
    return [];
  }
}
i.handle("obs:get-live-devices", async () => {
  try {
    return await Or();
  } catch {
    return [];
  }
});
async function Cr() {
  const e = v();
  if (!e) return "";
  try {
    const { recordDirectory: t } = await e.call("GetRecordDirectory");
    return typeof t == "string" ? t : "";
  } catch {
    return "";
  }
}
i.handle("obs:get-recording-directory", async () => {
  try {
    return await Cr();
  } catch {
    return "";
  }
});
async function Er() {
  const e = v();
  if (!e)
    return { preview: "", ch1: "", ch2: "", ch3: "", ch4: "" };
  let t = "";
  try {
    const { parameterValue: n } = await e.call("GetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting"
    });
    t = typeof n == "string" ? n : "";
  } catch {
    t = "";
  }
  const r = ["channel 1", "channel 2", "channel 3", "channel 4"], o = ["", "", "", ""];
  for (let n = 0; n < r.length; n++) {
    const a = r[n];
    try {
      const { filterSettings: s } = await e.call("GetSourceFilter", {
        sourceName: a,
        filterName: "source record"
      }), c = s && typeof s.filename_formatting == "string" ? s.filename_formatting : "";
      o[n] = c;
    } catch {
      o[n] = "";
    }
  }
  return {
    preview: t,
    ch1: o[0] || "",
    ch2: o[1] || "",
    ch3: o[2] || "",
    ch4: o[3] || ""
  };
}
i.handle("obs:get-file-name-formatting", async () => {
  try {
    return await Er();
  } catch {
    return { preview: "", ch1: "", ch2: "", ch3: "", ch4: "" };
  }
});
async function Tr(e) {
  const t = v();
  if (!t) return !1;
  let r = !0;
  try {
    await t.call("SetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting",
      parameterValue: `preview-${e}`
    });
  } catch {
    r = !1;
  }
  const o = [
    "channel 1",
    "channel 2",
    "channel 3",
    "channel 4"
  ];
  for (let n = 0; n < o.length; n++) {
    const a = o[n], s = n + 1;
    try {
      await t.call("SetSourceFilterSettings", {
        sourceName: a,
        filterName: "source record",
        filterSettings: { filename_formatting: `ch${s}-${e}` },
        overlay: !0
      });
    } catch {
      r = !1;
    }
  }
  return r;
}
i.handle("obs:set-file-name-formatting", async (e, t) => {
  try {
    return await Tr(t);
  } catch {
    return !1;
  }
});
async function jr(e) {
  const t = v();
  if (!t) return !1;
  let r = !0;
  try {
    await t.call("SetSourceFilterSettings", {
      sourceName: "clip recording",
      filterName: "source record",
      filterSettings: { filename_formatting: `clip-${e}` },
      overlay: !0
    });
  } catch {
    r = !1;
  }
  return r;
}
i.handle("obs:set-clip-file-name-formatting", async (e, t) => {
  try {
    return await jr(t);
  } catch {
    return !1;
  }
});
async function $r() {
  const e = v();
  if (!e) return !1;
  try {
    return await e.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_5",
      keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
    }), !0;
  } catch {
    return !1;
  }
}
i.handle("obs:start-clip-recording", async () => {
  try {
    return await $r();
  } catch {
    return !1;
  }
});
async function Pr() {
  const e = v();
  if (!e) return !1;
  try {
    return await e.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_6",
      keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
    }), !0;
  } catch {
    return !1;
  }
}
i.handle("obs:stop-clip-recording", async () => {
  try {
    return await Pr();
  } catch {
    return !1;
  }
});
let we = {
  isRecordingStarted: !1,
  isRecordingPaused: !1,
  isRecordingStopped: !1,
  isClipRecordingStarted: !1
};
function Dr() {
  return we;
}
function Ur(e) {
  we = { ...we, ...e };
}
i.handle("recording:getState", async () => {
  try {
    return { ok: !0, data: Dr() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
i.handle("recording:updateState", async (e, t) => {
  try {
    return Ur(t || {}), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
async function Rr(e, t, r, o, n) {
  const a = v();
  if (!a) return !1;
  let s = !0;
  if (e)
    try {
      await a.call("StartRecord");
    } catch {
      s = !1;
    }
  async function c(l) {
    const d = `OBS_KEY_${l}`;
    try {
      return await a.call("TriggerHotkeyByKeySequence", {
        keyId: d,
        keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
      }), !0;
    } catch {
      return !1;
    }
  }
  return t && (s = await c(1) && s), r && (s = await c(2) && s), o && (s = await c(3) && s), n && (s = await c(4) && s), s;
}
i.handle("obs:start-recording", async (e, t) => {
  try {
    const { preview: r, ch1: o, ch2: n, ch3: a, ch4: s } = t || {};
    return await Rr(!!r, !!o, !!n, !!a, !!s);
  } catch {
    return !1;
  }
});
async function xr() {
  const e = v();
  if (!e) return !1;
  let t = !0;
  try {
    await e.call("StopRecord");
  } catch {
    t = !1;
  }
  try {
    await e.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_0",
      keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
    });
  } catch {
    t = !1;
  }
  return t;
}
i.handle("obs:stop-recording", async () => {
  try {
    return await xr();
  } catch {
    return !1;
  }
});
async function Nr() {
  const e = v();
  if (!e) return !1;
  let t = !0;
  try {
    await e.call("ToggleRecordPause");
  } catch {
    t = !1;
  }
  try {
    await e.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_P",
      keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
    });
  } catch {
    t = !1;
  }
  return t;
}
i.handle("obs:pause-recording", async () => {
  try {
    return await Nr();
  } catch {
    return !1;
  }
});
async function Fr() {
  const e = v();
  if (!e) return !1;
  let t = !0;
  try {
    await e.call("ResumeRecord");
  } catch {
    t = !1;
  }
  try {
    await e.call("TriggerHotkeyByKeySequence", {
      keyId: "OBS_KEY_R",
      keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
    });
  } catch {
    t = !1;
  }
  return t;
}
i.handle("obs:resume-recording", async () => {
  try {
    return await Fr();
  } catch {
    return !1;
  }
});
const Lr = u.dirname(Fe(import.meta.url));
process.env.APP_ROOT = u.join(Lr, "..");
const Br = process.env.VITE_DEV_SERVER_URL, Jr = u.join(process.env.APP_ROOT, "dist-electron"), Mr = u.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Br ? u.join(process.env.APP_ROOT, "public") : Mr;
let p = null, O = null, k = null;
function ye(e) {
  return new Promise((t) => setTimeout(t, e));
}
function Hr(e) {
  return new Promise((t) => {
    if (e.isDestroyed() || e.isVisible()) return t();
    e.once("ready-to-show", () => t());
  });
}
async function xe() {
  O = Me(Se);
  const e = Date.now(), t = async (s) => {
    try {
      O && !O.isDestroyed() && await O.webContents.executeJavaScript(
        `window.postMessage({ type: 'status', text: ${JSON.stringify(s)} }, '*')`
      );
    } catch {
    }
  };
  await t("Checking OBS…");
  let r = !1;
  try {
    r = be();
  } catch {
    r = !1;
  }
  let o = !1;
  if (!r) {
    await t("Launching OBS…");
    try {
      Ye(), o = !0;
    } catch (s) {
      console.error("Failed to launch OBS:", s);
    }
  }
  if (o)
    for (await t("Waiting for OBS to start…"); ; ) {
      try {
        if (be()) break;
      } catch {
      }
      await ye(1e3);
    }
  await t("Connecting to OBS WebSocket…");
  try {
    await Qe();
  } catch {
  }
  for (; !await Ge(4e3); )
    await t("Failed to connect. Retrying…"), await ye(1500);
  p = He(), await Hr(p);
  const n = Date.now() - e, a = Math.max(0, Se - n);
  a > 0 && await ye(a), O && !O.isDestroyed() && O.close(), O = null, p == null || p.show(), p.webContents.on("render-process-gone", (s, c) => {
    console.error("Renderer crashed:", c);
  }), p.on("unresponsive", () => {
    console.warn("Window unresponsive");
  });
}
_.on("window-all-closed", () => {
  process.platform !== "darwin" && (_.quit(), p = null);
});
let Ce = !1;
_.on("before-quit", async (e) => {
  if (!Ce) {
    e.preventDefault(), Ce = !0;
    try {
      await Ke();
    } catch {
    }
    try {
      await Ze();
    } catch {
    }
    _.quit();
  }
});
_.on("activate", () => {
  T.getAllWindows().length === 0 && xe();
});
_.whenReady().then(xe);
i.on("overlay:get-port-sync", (e) => {
  try {
    e.returnValue = pe;
  } catch {
    e.returnValue = 3620;
  }
});
i.handle("window:open-overlay-editor", async () => {
  try {
    return k && !k.isDestroyed() ? (k.show(), k.focus(), !0) : (k = Ve(), k.on("closed", () => {
      k = null;
    }), !0);
  } catch {
    return !1;
  }
});
i.handle("overlay-window:minimize", async () => {
  try {
    return k == null || k.minimize(), !0;
  } catch {
    return !1;
  }
});
i.handle("overlay-window:close", async () => {
  try {
    return k == null || k.close(), !0;
  } catch {
    return !1;
  }
});
i.handle("window:minimize", async () => {
  try {
    return p == null || p.minimize(), !0;
  } catch {
    return !1;
  }
});
i.handle("window:close", async () => {
  try {
    return p == null || p.close(), !0;
  } catch {
    return !1;
  }
});
export {
  Jr as MAIN_DIST,
  Mr as RENDERER_DIST,
  Br as VITE_DEV_SERVER_URL
};
