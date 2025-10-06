import { BrowserWindow as $, ipcMain as d, app as A } from "electron";
import u from "node:path";
import { pathToFileURL as Ve, fileURLToPath as qe } from "node:url";
import { spawn as Te, spawnSync as be } from "node:child_process";
import I from "node:fs";
import We from "obs-websocket-js";
import Ye from "node:http";
import { MongoClient as y, ServerApiVersion as h, ObjectId as f } from "mongodb";
import Ge from "node:fs/promises";
let _ = null;
function Ke(e) {
  _ = new $({
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
  return _.loadFile(r), _.once("ready-to-show", () => _ == null ? void 0 : _.show()), _.timeoutMs = e, _;
}
function N() {
  return process.env.APP_ROOT ? u.join(process.env.APP_ROOT, "dist") : u.join(__dirname, "..", "..", "dist");
}
function je() {
  return process.env.VITE_DEV_SERVER_URL || "";
}
function ze() {
  const e = new $({
    width: 1280,
    height: 800,
    show: !1,
    title: "Deepstrim Capture",
    frame: !1,
    backgroundColor: "#0f0f0f",
    icon: u.join(process.env.VITE_PUBLIC || N(), "dc.ico"),
    webPreferences: {
      preload: u.join(process.env.APP_ROOT || u.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), t = je();
  return t ? e.loadURL(t) : e.loadFile(u.join(N(), "index.html")), e;
}
function Xe() {
  const e = new $({
    width: 1e3,
    height: 700,
    show: !0,
    frame: !1,
    backgroundColor: "#0f0f0f",
    icon: u.join(process.env.VITE_PUBLIC || N(), "dc.ico"),
    webPreferences: {
      preload: u.join(process.env.APP_ROOT || u.join(__dirname, "..", ".."), "dist-electron", "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      webSecurity: !1
    }
  }), t = je();
  return t ? e.loadURL(`${t}?window=overlay-editor`) : e.loadFile(u.join(N(), "index.html"), { query: { window: "overlay-editor" } }), e;
}
const L = "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe".replace(/\\/g, "\\"), B = "C:\\Program Files\\obs-studio\\bin\\64bit".replace(/\\/g, "\\"), Je = "ws://127.0.0.1:4455", Qe = ["--startvirtualcam", "--disable-shutdown-check"];
u.join(
  process.env.APPDATA || u.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "obs-studio",
  "basic",
  "profiles",
  "Default",
  "basic.ini"
);
const ke = 3620, g = "mongodb://localhost:27017/capture", Ie = 5e3;
function Ze() {
  if (!I.existsSync(L))
    throw new Error(`OBS executable not found at: ${L}`);
  if (!I.existsSync(B))
    throw new Error(`Working directory does not exist: ${B}`);
  const e = Te(L, Qe, {
    cwd: B,
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
async function et(e = 4e3) {
  try {
    if (C)
      return !0;
    const t = new We(), r = t.connect(Je), o = new Promise((n, a) => {
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
async function tt() {
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
function Ae() {
  try {
    if (process.platform === "win32") {
      const t = (be("tasklist", [], { encoding: "utf8" }).stdout || "").toLowerCase();
      return t ? t.includes("obs64.exe") || t.includes("obs.exe") : !1;
    }
    return process.platform === "darwin" || process.platform === "linux" ? (be("ps", ["-A", "-o", "comm="], { encoding: "utf8" }).stdout || "").toLowerCase().split(`
`).some((r) => r.includes("obs")) : !1;
  } catch {
    return !1;
  }
}
async function rt() {
  try {
    const e = v();
    if (!e) return "";
    const t = await e.call("GetCurrentProgramScene"), r = (t == null ? void 0 : t.currentProgramSceneName) ?? "";
    return typeof r == "string" ? r : "";
  } catch {
    return "";
  }
}
d.handle("obs:get-current-scene", async () => {
  try {
    return await rt();
  } catch {
    return "";
  }
});
async function nt(e) {
  try {
    const t = v();
    return t ? (await t.call("SetCurrentProgramScene", { sceneName: e }), !0) : !1;
  } catch {
    return !1;
  }
}
d.handle("obs:set-current-scene", async (e, t) => {
  try {
    return typeof t != "string" || !t.trim() ? !1 : await nt(t);
  } catch {
    return !1;
  }
});
let P = null, we = !1, R = null;
function ot() {
  const e = process.env.APP_ROOT || u.join(__dirname, "..", ".."), t = u.join(e, "drawing-service", "server.js"), r = t.replace(/\.asar(\\|\/)/, ".asar.unpacked$1");
  try {
    return require("fs").existsSync(r) ? r : t;
  } catch {
    return t;
  }
}
function _e(e, t) {
  const r = Date.now() + t;
  return new Promise((o) => {
    const n = () => {
      try {
        const a = Ye.get({ host: "127.0.0.1", port: e, path: "/health", timeout: 1e3 }, (s) => {
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
async function at(e) {
  try {
    if (P || we) return !0;
    const t = Number(e || ke || 3620) || 3620, r = ot();
    let o = "";
    try {
      o = u.join(A.getPath("userData"), "overlay-images");
    } catch {
      o = "";
    }
    process.env.OVERLAY_WS_PORT = String(t), process.env.OVERLAY_IMAGES_DIR = o;
    try {
      if (await import(Ve(r).href), we = !0, R = t, !await _e(t, 5e3))
        try {
          console.warn("[browser-source-service] did not become healthy in time");
        } catch {
        }
      return !0;
    } catch {
      const a = process.execPath;
      if (P = Te(a, [r], {
        cwd: u.dirname(r),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", OVERLAY_WS_PORT: String(t), OVERLAY_IMAGES_DIR: o },
        stdio: "ignore",
        detached: !1
      }), P.on("exit", (l, i) => {
        try {
          console.log(`[browser-source-service] exited code=${l} signal=${i}`);
        } catch {
        }
        P = null, R = null;
      }), R = t, !await _e(t, 5e3))
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
async function st() {
  try {
    const e = P;
    if (P = null, R = null, we = !1, !e) return;
    try {
      e.kill();
    } catch {
    }
  } catch {
  }
}
let M = null;
async function ct() {
  if (M) return M;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), M = e, e;
}
async function it(e) {
  const o = (await ct()).db("capture").collection("projects"), n = /* @__PURE__ */ new Date(), a = {
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
d.handle("db:createProject", async (e, t) => {
  var r, o;
  try {
    const n = await it(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let H = null;
async function lt() {
  if (H) return H;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), H = e, e;
}
async function dt(e) {
  const o = (await lt()).db("capture").collection("overlays"), n = /* @__PURE__ */ new Date(), a = e.name.trim();
  if (!a) throw new Error("Overlay name is required");
  const s = (m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (await o.findOne({ name: { $regex: `^${s(a)}$`, $options: "i" } })) throw new Error("An overlay with this name already exists");
  const l = {
    name: a,
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(l)).insertedId, ...l };
}
d.handle("db:createOverlay", async (e, t) => {
  var r, o, n, a;
  try {
    const s = await dt(t), c = ((o = (r = s == null ? void 0 : s._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? s;
    try {
      const l = { id: c, action: "created", name: ((a = (n = t == null ? void 0 : t.name) == null ? void 0 : n.trim) == null ? void 0 : a.call(n)) || "" };
      for (const i of $.getAllWindows())
        try {
          i.webContents.send("overlays:changed", l);
        } catch {
        }
    } catch {
    }
    return { ok: !0, data: c };
  } catch (s) {
    return { ok: !1, error: s instanceof Error ? s.message : "Unknown error" };
  }
});
let V = null;
async function ut() {
  if (V) return V;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), V = e, e;
}
async function ft() {
  return (await ut()).db("capture").collection("overlays").find({}).sort({ createdAt: -1 }).toArray();
}
d.handle("db:getAllOverlay", async () => {
  try {
    return { ok: !0, data: (await ft()).map((r) => ({
      _id: r._id.toString(),
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })) };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let q = null;
async function mt() {
  if (q) return q;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), q = e, e;
}
async function yt(e) {
  const o = (await mt()).db("capture").collection("tasks"), n = /* @__PURE__ */ new Date(), a = typeof e.remarks == "string" ? e.remarks.trim() : void 0, s = e.name.trim();
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
d.handle("db:createTask", async (e, t) => {
  var r, o;
  try {
    const n = await yt(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let W = null;
async function ht() {
  if (W) return W;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), W = e, e;
}
async function gt(e) {
  return (await ht()).db("capture").collection("tasks").find({ projectId: new f(e) }).sort({ createdAt: -1 }).toArray();
}
d.handle("db:getAllTasks", async (e, t) => {
  try {
    return !t || typeof t != "string" ? { ok: !1, error: "projectId is required" } : { ok: !0, data: (await gt(t)).map((n) => {
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
let Y = null;
async function wt() {
  if (Y) return Y;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Y = e, e;
}
async function pt(e) {
  const o = (await wt()).db("capture").collection("tasks"), n = new f(e);
  return await o.findOne({ _id: n });
}
d.handle("db:getSelectedTaskDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid taskId" };
    const r = await pt(t);
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
let G = null;
async function vt() {
  if (G) return G;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), G = e, e;
}
async function kt(e, t) {
  const n = (await vt()).db("capture").collection("tasks"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
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
d.handle("db:editTask", async (e, t, r) => {
  try {
    return { ok: !0, data: await kt(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let K = null;
async function St() {
  if (K) return K;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), K = e, e;
}
async function bt(e) {
  const o = (await St()).db("capture").collection("dives"), n = /* @__PURE__ */ new Date(), a = typeof e.remarks == "string" ? e.remarks.trim() : void 0, s = e.name.trim();
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
d.handle("db:createDive", async (e, t) => {
  var r, o;
  try {
    const n = await bt(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let z = null;
async function It() {
  if (z) return z;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), z = e, e;
}
async function At(e) {
  const r = (await It()).db("capture"), o = r.collection("sessions"), n = /* @__PURE__ */ new Date();
  if (![e.preview, e.ch1, e.ch2, e.ch3, e.ch4].some((b) => typeof b == "string" && b.trim().length > 0))
    throw new Error("At least one of preview/ch1/ch2/ch3/ch4 must be provided");
  const s = typeof e.nodeId == "string" && e.nodeId.trim() ? new f(e.nodeId.trim()) : null, c = new f(e.diveId), l = new f(e.taskId), [i, m] = await Promise.all([
    r.collection("dives").findOne({ _id: c }, { projection: { name: 1 } }),
    r.collection("tasks").findOne({ _id: l }, { projection: { name: 1 } })
  ]);
  let w = [];
  if (s) {
    const b = r.collection("nodes"), D = [];
    let U = s;
    for (; U; ) {
      const F = await b.findOne({ _id: U }, { projection: { name: 1, parentId: 1 } });
      if (!F) break;
      D.push({ id: U, name: String(F.name || "") });
      const Se = F.parentId;
      if (!Se) break;
      U = Se;
    }
    w = D.reverse();
  }
  let p;
  if (w.length > 0)
    for (let b = w.length - 1; b >= 0; b--) {
      const D = w[b];
      p ? p = { id: w[b].id, name: w[b].name, children: p } : p = { id: D.id, name: D.name };
    }
  const T = {
    projectId: new f(e.projectId),
    diveId: c,
    taskId: l,
    dive: { id: c, name: String((i == null ? void 0 : i.name) || "") },
    task: { id: l, name: String((m == null ? void 0 : m.name) || "") },
    ...p ? { nodesHierarchy: p } : {},
    ...e.preview && e.preview.trim() ? { preview: e.preview.trim() } : {},
    ...e.ch1 && e.ch1.trim() ? { ch1: e.ch1.trim() } : {},
    ...e.ch2 && e.ch2.trim() ? { ch2: e.ch2.trim() } : {},
    ...e.ch3 && e.ch3.trim() ? { ch3: e.ch3.trim() } : {},
    ...e.ch4 && e.ch4.trim() ? { ch4: e.ch4.trim() } : {},
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(T)).insertedId, ...T };
}
d.handle("db:createSession", async (e, t) => {
  var r, o;
  try {
    const n = await At(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let X = null;
async function _t() {
  if (X) return X;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), X = e, e;
}
async function Ot(e, t) {
  const n = (await _t()).db("capture").collection("dives"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
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
d.handle("db:editDive", async (e, t, r) => {
  try {
    return { ok: !0, data: await Ot(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let J = null;
async function Ct() {
  if (J) return J;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), J = e, e;
}
async function Et(e) {
  const o = (await Ct()).db("capture").collection("nodes"), n = /* @__PURE__ */ new Date(), a = new f(e.projectId);
  let s = 0, c;
  if (e.parentId) {
    c = new f(e.parentId);
    const w = await o.findOne({ _id: c });
    if (!w) throw new Error("Parent node not found");
    if (!w.projectId.equals(a))
      throw new Error("Parent node belongs to a different project");
    s = (w.level ?? 0) + 1;
  }
  const l = typeof e.remarks == "string" ? e.remarks.trim() : void 0, i = {
    projectId: a,
    name: e.name.trim(),
    ...c ? { parentId: c } : {},
    ...l ? { remarks: l } : {},
    level: s,
    createdAt: n,
    updatedAt: n
  };
  return { _id: (await o.insertOne(i)).insertedId, ...i };
}
d.handle("db:createNode", async (e, t) => {
  try {
    return { ok: !0, data: await Et(t) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let Q = null;
async function $t() {
  if (Q) return Q;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Q = e, e;
}
async function Tt(e, t) {
  const n = (await $t()).db("capture").collection("nodes"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
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
d.handle("db:editNode", async (e, t, r) => {
  try {
    return { ok: !0, data: await Tt(t, r) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let Z = null;
async function jt() {
  if (Z) return Z;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), Z = e, e;
}
async function Pt(e) {
  const o = (await jt()).db("capture").collection("nodes"), n = new f(e), a = await o.find({ projectId: n }).sort({ level: 1, createdAt: 1, name: 1 }).toArray(), s = /* @__PURE__ */ new Map(), c = [];
  for (const l of a)
    s.set(l._id.toHexString(), { ...l, children: [] });
  for (const l of a) {
    const i = s.get(l._id.toHexString());
    if (l.parentId) {
      const m = s.get(l.parentId.toHexString());
      m ? m.children.push(i) : c.push(i);
    } else
      c.push(i);
  }
  return c;
}
d.handle("db:getAllNodes", async (e, t) => {
  try {
    const r = await Pt(t), o = (n) => {
      var a, s, c, l, i, m;
      return {
        _id: ((s = (a = n._id) == null ? void 0 : a.toString) == null ? void 0 : s.call(a)) ?? n._id,
        projectId: ((l = (c = n.projectId) == null ? void 0 : c.toString) == null ? void 0 : l.call(c)) ?? n.projectId,
        parentId: n.parentId ? ((m = (i = n.parentId).toString) == null ? void 0 : m.call(i)) ?? n.parentId : void 0,
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
let ee = null;
async function Dt() {
  if (ee) return ee;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ee = e, e;
}
async function Ut(e) {
  const o = (await Dt()).db("capture").collection("nodes"), n = new f(e), a = /* @__PURE__ */ new Set([n.toHexString()]);
  let s = [n];
  for (; s.length; ) {
    const i = await o.find({ parentId: { $in: s } }, { projection: { _id: 1 } }).toArray(), m = [];
    for (const w of i) {
      const p = w._id.toHexString();
      a.has(p) || (a.add(p), m.push(w._id));
    }
    s = m;
  }
  const c = Array.from(a).map((i) => new f(i));
  return (await o.deleteMany({ _id: { $in: c } })).deletedCount ?? 0;
}
d.handle("db:deleteNode", async (e, t) => {
  try {
    return { ok: !0, data: { deletedCount: await Ut(t) } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let te = null;
async function Rt() {
  if (te) return te;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), te = e, e;
}
async function Nt(e) {
  const o = (await Rt()).db("capture").collection("nodes"), n = new f(e);
  return await o.findOne({ _id: n });
}
d.handle("db:getSelectedNodeDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid nodeId" };
    const r = await Nt(t);
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
let re = null;
async function xt() {
  if (re) return re;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), re = e, e;
}
async function Ft() {
  return (await xt()).db("capture").collection("projects").find({}).sort({ createdAt: -1 }).toArray();
}
d.handle("db:getAllProjects", async () => {
  try {
    return { ok: !0, data: (await Ft()).map((r) => ({
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
let Pe = null;
function Lt(e) {
  Pe = e && e.trim() || null;
}
function Bt() {
  return Pe;
}
d.handle("app:setSelectedProjectId", async (e, t) => {
  try {
    return Lt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedProjectId", async () => {
  try {
    return { ok: !0, data: Bt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let De = null;
function Mt(e) {
  De = e && e.trim() || null;
}
function Ht() {
  return De;
}
d.handle("app:setSelectedDiveId", async (e, t) => {
  try {
    return Mt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedDiveId", async () => {
  try {
    return { ok: !0, data: Ht() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let E = null;
function Vt() {
  return E;
}
function qt(e, t) {
  t ? E = e && e.trim() || null : E && e && E === e.trim() ? E = null : e || (E = null);
}
d.handle("dive:getStartedDiveId", async () => {
  try {
    return { ok: !0, data: Vt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
d.handle("dive:isStarted", async (e, t) => {
  try {
    const r = typeof t == "string" && t.trim() || null;
    return { ok: !0, data: !!(r && E === r) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("dive:setStarted", async (e, t, r) => {
  try {
    return qt(typeof t == "string" ? t : null, !!r), { ok: !0 };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
let Ue = null;
function Wt(e) {
  Ue = e && e.trim() || null;
}
function Yt() {
  return Ue;
}
d.handle("app:setSelectedTaskId", async (e, t) => {
  try {
    return Wt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedTaskId", async () => {
  try {
    return { ok: !0, data: Yt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let Re = null;
function Gt(e) {
  Re = e && e.trim() || null;
}
function Kt() {
  return Re;
}
d.handle("app:setSelectedNodeId", async (e, t) => {
  try {
    return Gt(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedNodeId", async () => {
  try {
    return { ok: !0, data: Kt() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let ne = null;
async function zt() {
  if (ne) return ne;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ne = e, e;
}
async function Xt(e) {
  return (await zt()).db("capture").collection("dives").find({ projectId: new f(e) }).sort({ createdAt: -1 }).toArray();
}
d.handle("db:getAllDives", async (e, t) => {
  try {
    return !t || typeof t != "string" ? { ok: !1, error: "projectId is required" } : { ok: !0, data: (await Xt(t)).map((n) => {
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
let oe = null;
async function Jt() {
  if (oe) return oe;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), oe = e, e;
}
async function Qt(e) {
  const o = (await Jt()).db("capture").collection("projects"), n = new f(e);
  return await o.findOne({ _id: n });
}
d.handle("db:getSelectedProjectDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid projectId" };
    const r = await Qt(t);
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
let ae = null;
async function Zt() {
  if (ae) return ae;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ae = e, e;
}
async function er(e) {
  const o = (await Zt()).db("capture").collection("dives"), n = new f(e);
  return await o.findOne({ _id: n });
}
d.handle("db:getSelectedDiveDetails", async (e, t) => {
  try {
    if (!t || typeof t != "string")
      return { ok: !1, error: "Invalid diveId" };
    const r = await er(t);
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
let se = null;
async function tr() {
  if (se) return se;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), se = e, e;
}
async function rr(e, t) {
  const n = (await tr()).db("capture").collection("projects"), a = new f(e), c = { updatedAt: /* @__PURE__ */ new Date() };
  if (typeof t.name == "string" && (c.name = t.name.trim()), typeof t.client == "string" && (c.client = t.client.trim()), typeof t.contractor == "string" && (c.contractor = t.contractor.trim()), typeof t.vessel == "string" && (c.vessel = t.vessel.trim()), typeof t.location == "string" && (c.location = t.location.trim()), t.hasOwnProperty("lastSelectedDiveId")) {
    const i = t.lastSelectedDiveId;
    c.lastSelectedDiveId = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedTaskId")) {
    const i = t.lastSelectedTaskId;
    c.lastSelectedTaskId = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedNodeId")) {
    const i = t.lastSelectedNodeId;
    c.lastSelectedNodeId = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh1Id")) {
    const i = t.lastSelectedOverlayCh1Id;
    c.lastSelectedOverlayCh1Id = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh2Id")) {
    const i = t.lastSelectedOverlayCh2Id;
    c.lastSelectedOverlayCh2Id = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh3Id")) {
    const i = t.lastSelectedOverlayCh3Id;
    c.lastSelectedOverlayCh3Id = typeof i == "string" && i.trim() || null;
  }
  if (t.hasOwnProperty("lastSelectedOverlayCh4Id")) {
    const i = t.lastSelectedOverlayCh4Id;
    c.lastSelectedOverlayCh4Id = typeof i == "string" && i.trim() || null;
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
d.handle("db:editProject", async (e, t, r) => {
  try {
    const o = await rr(t, r);
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
let Ne = null;
function nr(e) {
  Ne = e;
}
function or() {
  return Ne;
}
d.handle("app:setSelectedDrawingTool", async (e, t) => {
  try {
    return nr(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedDrawingTool", async () => {
  try {
    return { ok: !0, data: or() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let xe = null;
function ar(e) {
  xe = e && e.trim() || null;
}
function sr() {
  return xe;
}
d.handle("app:setSelectedOverlayLayerId", async (e, t) => {
  try {
    return ar(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedOverlayLayerId", async () => {
  try {
    return { ok: !0, data: sr() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let pe = [];
function cr(e) {
  if (!e || !Array.isArray(e)) {
    pe = [];
    return;
  }
  const t = e.map((r) => typeof r == "string" ? r.trim() : "").filter((r) => !!r);
  pe = Array.from(new Set(t));
}
function ir() {
  return [...pe];
}
d.handle("app:setSelectedOverlayComponentIds", async (e, t) => {
  try {
    return cr(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getSelectedOverlayComponentIds", async () => {
  try {
    return { ok: !0, data: ir() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let Fe = null;
function lr(e) {
  Fe = e && e.trim() || null;
}
function Le() {
  return Fe;
}
d.handle("app:setActiveSessionId", async (e, t) => {
  try {
    return lr(t), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
d.handle("app:getActiveSessionId", async () => {
  try {
    return { ok: !0, data: Le() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
let ce = null;
async function dr() {
  if (ce) return ce;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ce = e, e;
}
async function ur(e, t) {
  const n = (await dr()).db("capture").collection("overlays"), a = new f(e), s = /* @__PURE__ */ new Date(), c = t.trim();
  if (!c) throw new Error("Overlay name is required");
  const l = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (await n.findOne({ _id: { $ne: a }, name: { $regex: `^${l(c)}$`, $options: "i" } })) throw new Error("An overlay with this name already exists");
  return await n.updateOne({ _id: a }, { $set: { name: c, updatedAt: s } }), await n.findOne({ _id: a });
}
d.handle("db:renameOverlay", async (e, t) => {
  var r, o;
  try {
    if (!(t != null && t.id) || !(t != null && t.name) || !t.name.trim()) throw new Error("Invalid input");
    const n = await ur(t.id, t.name), a = ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? t.id;
    try {
      const s = { id: a, name: t.name, action: "renamed" };
      for (const c of $.getAllWindows())
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
let ie = null;
async function fr() {
  if (ie) return ie;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ie = e, e;
}
async function mr(e) {
  const o = (await fr()).db("capture").collection("overlays"), n = new f(e);
  return (await o.deleteOne({ _id: n })).deletedCount === 1;
}
d.handle("db:deleteOverlay", async (e, t) => {
  try {
    if (!(t != null && t.id)) throw new Error("Invalid id");
    if (!await mr(t.id)) throw new Error("Overlay not found");
    try {
      const o = { id: t.id, action: "deleted" };
      for (const n of $.getAllWindows())
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
let le = null;
async function yr() {
  if (le) return le;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), le = e, e;
}
async function hr(e) {
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
  const c = (await yr()).db("capture").collection("overlay_components"), l = await c.countDocuments({ overlayId: t }), i = `${e.type}-${l + 1}`, x = {
    overlayId: t,
    name: e.name && e.name.trim() ? e.name.trim() : i,
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
d.handle("db:createOverlayComponent", async (e, t) => {
  var r, o;
  try {
    const n = await hr(t);
    return { ok: !0, data: ((o = (r = n == null ? void 0 : n._id) == null ? void 0 : r.toString) == null ? void 0 : o.call(r)) ?? n };
  } catch (n) {
    return { ok: !1, error: n instanceof Error ? n.message : "Unknown error" };
  }
});
let de = null;
async function gr() {
  if (de) return de;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), de = e, e;
}
async function wr(e) {
  const o = (await gr()).db("capture").collection("overlay_components"), n = e ? { overlayId: new f(e) } : {};
  return o.find(n, { projection: { _id: 1, name: 1 } }).sort({ createdAt: -1 }).toArray();
}
d.handle("db:getAllOverlayComponents", async (e, t) => {
  try {
    return { ok: !0, data: (await wr(t == null ? void 0 : t.overlayId)).map((n) => ({ _id: n._id.toString(), name: n.name })) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let ue = null;
async function pr() {
  if (ue) return ue;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), ue = e, e;
}
function vr(e) {
  const t = { updatedAt: /* @__PURE__ */ new Date() };
  return typeof e.overlayId == "string" && e.overlayId.trim() && (t.overlayId = new f(e.overlayId)), typeof e.name == "string" && (t.name = e.name.trim()), typeof e.type == "string" && (t.type = e.type), typeof e.x == "number" && (t.x = e.x), typeof e.y == "number" && (t.y = e.y), typeof e.width == "number" && (t.width = Math.max(1, e.width)), typeof e.height == "number" && (t.height = Math.max(1, e.height)), typeof e.backgroundColor == "string" && (t.backgroundColor = e.backgroundColor), typeof e.borderColor == "string" && (t.borderColor = e.borderColor), typeof e.radius == "number" && (t.radius = e.radius), typeof e.textStyle == "object" && e.textStyle && (t.textStyle = e.textStyle), typeof e.customText == "string" && (t.customText = e.customText), typeof e.dateFormat == "string" && (t.dateFormat = e.dateFormat), typeof e.twentyFourHour == "boolean" && (t.twentyFourHour = e.twentyFourHour), typeof e.useUTC == "boolean" && (t.useUTC = e.useUTC), typeof e.dataType == "string" && (t.dataType = e.dataType), typeof e.nodeLevel == "number" && (t.nodeLevel = e.nodeLevel), typeof e.imagePath == "string" && (t.imagePath = e.imagePath), t;
}
async function kr(e, t) {
  const n = (await pr()).db("capture").collection("overlay_components"), a = Array.from(new Set((e || []).map((i) => typeof i == "string" ? i.trim() : "").filter(Boolean)));
  if (!a.length) return 0;
  const s = a.map((i) => new f(i)), c = vr(t);
  return (await n.updateMany({ _id: { $in: s } }, { $set: c })).modifiedCount ?? 0;
}
d.handle("db:editOverlayComponent", async (e, t) => {
  try {
    if (!t || !Array.isArray(t.ids) || !t.updates || typeof t.updates != "object") throw new Error("Invalid input");
    const r = await kr(t.ids, t.updates);
    if (r === 0) throw new Error("Overlay component(s) not found");
    return { ok: !0, data: { ids: t.ids, modified: r } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let fe = null;
async function Sr() {
  if (fe) return fe;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), fe = e, e;
}
async function br(e) {
  const t = Array.from(new Set((e || []).map((c) => typeof c == "string" ? c.trim() : "").filter(Boolean)));
  if (!t.length) return 0;
  const n = (await Sr()).db("capture").collection("overlay_components"), a = t.map((c) => new f(c));
  return (await n.deleteMany({ _id: { $in: a } })).deletedCount ?? 0;
}
d.handle("db:deleteOverlayComponent", async (e, t) => {
  try {
    if (!t || !Array.isArray(t.ids)) throw new Error("Invalid ids");
    const r = await br(t.ids);
    return { ok: !0, data: { ids: t.ids, deleted: r } };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
let me = null;
async function Ir() {
  if (me) return me;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), me = e, e;
}
async function Ar(e) {
  const o = (await Ir()).db("capture").collection("overlay_components"), n = { overlayId: new f(e) }, a = {
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
d.handle("db:getOverlayComponentsForRender", async (e, t) => {
  try {
    if (!(t != null && t.overlayId)) throw new Error("overlayId is required");
    return { ok: !0, data: (await Ar(t.overlayId)).map((n) => ({
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
function _r() {
  if (process.platform !== "win32")
    throw new Error("This application supports Windows only");
  const e = A.getPath("userData"), t = u.join(e, "overlay-images");
  try {
    I.mkdirSync(t, { recursive: !0 });
  } catch {
  }
  return t;
}
function Or(e) {
  const t = e.toLowerCase();
  return t === ".png" || t === ".jpg" || t === ".jpeg" || t === ".webp" || t === ".bmp";
}
function Oe(e) {
  const t = u.extname(e || "").toLowerCase();
  if (!Or(t)) throw new Error("Unsupported image type");
  const o = u.basename(e, t).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "image", n = /* @__PURE__ */ new Date(), a = n.getFullYear(), s = String(n.getMonth() + 1).padStart(2, "0"), c = String(n.getDate()).padStart(2, "0"), l = String(n.getHours()).padStart(2, "0"), i = String(n.getMinutes()).padStart(2, "0"), m = String(n.getSeconds()).padStart(2, "0");
  return `${o}_${a}${s}${c}_${l}${i}${m}${t}`;
}
async function Cr(e) {
  if (!e || typeof e != "object") throw new Error("Invalid input");
  const t = _r();
  if (e.sourcePath) {
    const r = u.resolve(e.sourcePath);
    if (!I.statSync(r).isFile()) throw new Error("Source is not a file");
    const n = Oe(u.basename(r)), a = u.join(t, n);
    I.copyFileSync(r, a);
    const s = `file://${a.replace(/\\/g, "/")}`, c = Ce(n);
    return { absolutePath: a, fileUrl: s, httpUrl: c, filename: n };
  }
  if (e.bytesBase64) {
    const r = e.filename && e.filename.trim() ? e.filename.trim() : "image.png", o = Oe(r), n = u.join(t, o), a = Buffer.from(e.bytesBase64, "base64");
    I.writeFileSync(n, a);
    const s = `file://${n.replace(/\\/g, "/")}`, c = Ce(o);
    return { absolutePath: n, fileUrl: s, httpUrl: c, filename: o };
  }
  throw new Error("Provide either sourcePath or bytesBase64");
}
function Ce(e) {
  try {
    return `http://127.0.0.1:${Number(process.env.OVERLAY_WS_PORT || ke || 3620) || 3620}/images/${encodeURIComponent(e)}`;
  } catch {
    return "";
  }
}
d.handle("fs:uploadOverlayImage", async (e, t) => {
  try {
    return { ok: !0, data: await Cr(t) };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
function Er() {
  if (process.platform !== "win32")
    throw new Error("This application supports Windows only");
  const e = A.getPath("userData"), t = u.join(e, "overlay-images");
  try {
    I.mkdirSync(t, { recursive: !0 });
  } catch {
  }
  return t;
}
function $r(e) {
  const t = e.toLowerCase();
  return t === ".png" || t === ".jpg" || t === ".jpeg" || t === ".webp" || t === ".bmp";
}
function Tr(e) {
  return `file://${e.replace(/\\/g, "/")}`;
}
function jr(e) {
  try {
    return `http://127.0.0.1:${Number(process.env.OVERLAY_WS_PORT || 3620) || 3620}/images/${encodeURIComponent(e)}`;
  } catch {
    return "";
  }
}
function Pr() {
  const e = Er();
  let t = [];
  try {
    const r = I.readdirSync(e);
    for (const o of r)
      try {
        const n = u.extname(o);
        if (!$r(n)) continue;
        const a = u.join(e, o), s = I.statSync(a);
        if (!s.isFile()) continue;
        t.push({
          absolutePath: a,
          fileUrl: Tr(a),
          httpUrl: jr(o),
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
d.handle("fs:getAllOverlayImages", async () => {
  try {
    return { ok: !0, data: Pr() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
const Dr = "video sources", Ee = "source 1", ye = "video capture device 1";
async function Ur() {
  const e = v();
  if (!e) return [];
  try {
    try {
      const o = await e.call("GetGroupSceneItemList", { groupName: Ee });
      if (!(Array.isArray(o == null ? void 0 : o.sceneItems) ? o.sceneItems.some((a) => String((a == null ? void 0 : a.sourceName) ?? "").toLowerCase() === ye) : !1))
        try {
          const a = await e.call("GetSceneItemList", { sceneName: Dr }), s = Array.isArray(a == null ? void 0 : a.sceneItems) ? a.sceneItems.some((c) => String((c == null ? void 0 : c.sourceName) ?? "").toLowerCase() === Ee) : !1;
        } catch {
        }
    } catch {
    }
    try {
      const o = await e.call("GetInputList"), n = (Array.isArray(o == null ? void 0 : o.inputs) ? o.inputs : []).find((a) => String((a == null ? void 0 : a.inputName) ?? "").toLowerCase() === ye);
    } catch {
    }
    const t = [];
    return await (async (o) => {
      try {
        const n = await e.call("GetInputPropertiesListPropertyItems", {
          inputName: ye,
          propertyName: o
        }), a = Array.isArray(n == null ? void 0 : n.propertyItems) ? n.propertyItems : [];
        for (const s of a) {
          const c = String((s == null ? void 0 : s.itemName) ?? (s == null ? void 0 : s.name) ?? "").trim(), l = String((s == null ? void 0 : s.itemValue) ?? (s == null ? void 0 : s.value) ?? "").trim();
          c && l && !t.some((i) => i.id === l) && t.push({ id: l, name: c });
        }
      } catch {
      }
    })("video_device_id"), t.filter((o) => !/obs/i.test(o.name));
  } catch {
    return [];
  }
}
d.handle("obs:get-live-devices", async () => {
  try {
    return await Ur();
  } catch {
    return [];
  }
});
async function Be() {
  const e = v();
  if (!e) return "";
  try {
    const { recordDirectory: t } = await e.call("GetRecordDirectory");
    return typeof t == "string" ? t : "";
  } catch {
    return "";
  }
}
d.handle("obs:get-recording-directory", async () => {
  try {
    return await Be();
  } catch {
    return "";
  }
});
async function Rr() {
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
d.handle("obs:get-file-name-formatting", async () => {
  try {
    return await Rr();
  } catch {
    return { preview: "", ch1: "", ch2: "", ch3: "", ch4: "" };
  }
});
async function Nr(e) {
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
d.handle("obs:set-file-name-formatting", async (e, t) => {
  try {
    return await Nr(t);
  } catch {
    return !1;
  }
});
async function xr(e) {
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
d.handle("obs:set-clip-file-name-formatting", async (e, t) => {
  try {
    return await xr(t);
  } catch {
    return !1;
  }
});
async function Fr() {
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
d.handle("obs:start-clip-recording", async () => {
  try {
    return await Fr();
  } catch {
    return !1;
  }
});
async function Lr() {
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
d.handle("obs:stop-clip-recording", async () => {
  try {
    return await Lr();
  } catch {
    return !1;
  }
});
let ve = {
  isRecordingStarted: !1,
  isRecordingPaused: !1,
  isRecordingStopped: !1,
  isClipRecordingStarted: !1
};
function Br() {
  return ve;
}
function Mr(e) {
  ve = { ...ve, ...e };
}
d.handle("recording:getState", async () => {
  try {
    return { ok: !0, data: Br() };
  } catch (e) {
    return { ok: !1, error: e instanceof Error ? e.message : "Unknown error" };
  }
});
d.handle("recording:updateState", async (e, t) => {
  try {
    return Mr(t || {}), { ok: !0 };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
async function Hr(e, t, r, o, n) {
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
    const i = `OBS_KEY_${l}`;
    try {
      return await a.call("TriggerHotkeyByKeySequence", {
        keyId: i,
        keyModifiers: { shift: !1, control: !0, alt: !1, command: !1 }
      }), !0;
    } catch {
      return !1;
    }
  }
  return t && (s = await c(1) && s), r && (s = await c(2) && s), o && (s = await c(3) && s), n && (s = await c(4) && s), s;
}
d.handle("obs:start-recording", async (e, t) => {
  try {
    const { preview: r, ch1: o, ch2: n, ch3: a, ch4: s } = t || {};
    return await Hr(!!r, !!o, !!n, !!a, !!s);
  } catch {
    return !1;
  }
});
async function Vr() {
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
d.handle("obs:stop-recording", async () => {
  try {
    return await Vr();
  } catch {
    return !1;
  }
});
async function qr() {
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
d.handle("obs:pause-recording", async () => {
  try {
    return await qr();
  } catch {
    return !1;
  }
});
async function Wr() {
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
d.handle("obs:resume-recording", async () => {
  try {
    return await Wr();
  } catch {
    return !1;
  }
});
let he = null;
async function Yr() {
  if (he) return he;
  const e = new y(g, {
    serverApi: {
      version: h.v1,
      strict: !0,
      deprecationErrors: !0
    }
  });
  return await e.connect(), he = e, e;
}
function j(e) {
  if (!Array.isArray(e)) return;
  const t = e.map((r) => typeof r == "string" ? r.trim() : "").filter(Boolean);
  return t.length > 0 ? t : void 0;
}
async function Me(e, t) {
  const n = (await Yr()).db("capture").collection("sessions"), a = new f(e), s = {}, c = j(t.preview), l = j(t.ch1), i = j(t.ch2), m = j(t.ch3), w = j(t.ch4), p = j(t.clips);
  if (c && (s["snapshots.preview"] = { $each: c }), l && (s["snapshots.ch1"] = { $each: l }), i && (s["snapshots.ch2"] = { $each: i }), m && (s["snapshots.ch3"] = { $each: m }), w && (s["snapshots.ch4"] = { $each: w }), p && (s.clips = { $each: p }), Object.keys(s).length === 0)
    throw new Error("No paths provided to append");
  const T = await n.findOneAndUpdate(
    { _id: a },
    {
      ...Object.keys(s).length ? { $push: s } : {},
      $set: { updatedAt: /* @__PURE__ */ new Date() }
    },
    { returnDocument: "after", includeResultMetadata: !1 }
  );
  if (!T) throw new Error("Session not found");
  return T;
}
d.handle("db:editSession", async (e, t, r) => {
  try {
    const o = await Me(t, r || {});
    return { ok: !0, data: String(o._id) };
  } catch (o) {
    return { ok: !1, error: o instanceof Error ? o.message : "Unknown error" };
  }
});
async function Gr(e, t, r) {
  if (typeof t == "string" && t.trim()) return t.trim();
  if (!e) return null;
  try {
    const o = await e.call("GetSceneList"), a = (Array.isArray(o == null ? void 0 : o.scenes) ? o.scenes : []).map((i) => ({ raw: String((i == null ? void 0 : i.sceneName) ?? ""), low: String((i == null ? void 0 : i.sceneName) ?? "").toLowerCase() })), s = [
      `channel ${r}`,
      `ch${r}`,
      `source ${r}`
    ];
    for (const i of s) {
      const m = a.find((w) => w.low === i);
      if (m) return m.raw;
    }
    const c = [
      `channel ${r}`,
      `ch${r}`,
      `source ${r}`,
      `${r}`
    ], l = a.find((i) => c.some((m) => i.low.includes(m)));
    return l ? l.raw : null;
  } catch {
    return null;
  }
}
async function Kr(e) {
  const t = v();
  if (!t) return [];
  let r = "";
  const o = typeof (e == null ? void 0 : e.outputDir) == "string" ? e.outputDir.trim() : "";
  o ? r = o : r = await Be();
  try {
    r && !I.existsSync(r) && await Ge.mkdir(r, { recursive: !0 });
  } catch {
  }
  Math.max(1, Math.min(3840, Math.floor(Number((e == null ? void 0 : e.width) ?? 0)) || 0)), Math.max(1, Math.min(2160, Math.floor(Number((e == null ? void 0 : e.height) ?? 0)) || 0));
  const n = typeof (e == null ? void 0 : e.fileName) == "string" ? e.fileName.trim() : "", a = [], s = [], c = async (l, i) => {
    const m = await Gr(t, i, l);
    if (!m) return;
    const w = n || `snapshot_ch${l}`, p = u.join(r || process.cwd(), `${w}.png`);
    try {
      await t.call("SaveSourceScreenshot", {
        sourceName: m,
        imageFormat: "png",
        imageFilePath: p
      }), a.push(p);
    } catch {
    }
  };
  return e != null && e.ch1 && s.push(c(1, e.ch1)), e != null && e.ch2 && s.push(c(2, e.ch2)), e != null && e.ch3 && s.push(c(3, e.ch3)), e != null && e.ch4 && s.push(c(4, e.ch4)), await Promise.all(s), a;
}
d.handle("obs:take-snapshot", async (e, t) => {
  try {
    const r = await Kr(t || {});
    try {
      const o = Le();
      if (o && Array.isArray(r) && r.length) {
        const n = r.filter((i) => /\bch1\b/i.test(i) || /ch1-/i.test(i)), a = r.filter((i) => /\bch2\b/i.test(i) || /ch2-/i.test(i)), s = r.filter((i) => /\bch3\b/i.test(i) || /ch3-/i.test(i)), c = r.filter((i) => /\bch4\b/i.test(i) || /ch4-/i.test(i)), l = {};
        if (n.length && (l.ch1 = n), a.length && (l.ch2 = a), s.length && (l.ch3 = s), c.length && (l.ch4 = c), Object.keys(l).length)
          try {
            await Me(o, l);
          } catch {
          }
      }
    } catch {
    }
    return { ok: !0, data: r };
  } catch (r) {
    return { ok: !1, error: r instanceof Error ? r.message : "Unknown error" };
  }
});
const zr = u.dirname(qe(import.meta.url));
process.env.APP_ROOT = u.join(zr, "..");
const Xr = process.env.VITE_DEV_SERVER_URL, ln = u.join(process.env.APP_ROOT, "dist-electron"), Jr = u.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Xr ? u.join(process.env.APP_ROOT, "public") : Jr;
let k = null, O = null, S = null;
function ge(e) {
  return new Promise((t) => setTimeout(t, e));
}
function Qr(e) {
  return new Promise((t) => {
    if (e.isDestroyed() || e.isVisible()) return t();
    e.once("ready-to-show", () => t());
  });
}
async function He() {
  O = Ke(Ie);
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
    r = Ae();
  } catch {
    r = !1;
  }
  let o = !1;
  if (!r) {
    await t("Launching OBS…");
    try {
      Ze(), o = !0;
    } catch (s) {
      console.error("Failed to launch OBS:", s);
    }
  }
  if (o)
    for (await t("Waiting for OBS to start…"); ; ) {
      try {
        if (Ae()) break;
      } catch {
      }
      await ge(1e3);
    }
  await t("Connecting to OBS WebSocket…");
  try {
    await at();
  } catch {
  }
  for (; !await et(4e3); )
    await t("Failed to connect. Retrying…"), await ge(1500);
  k = ze(), await Qr(k);
  const n = Date.now() - e, a = Math.max(0, Ie - n);
  a > 0 && await ge(a), O && !O.isDestroyed() && O.close(), O = null, k == null || k.show(), k.webContents.on("render-process-gone", (s, c) => {
    console.error("Renderer crashed:", c);
  }), k.on("unresponsive", () => {
    console.warn("Window unresponsive");
  });
}
A.on("window-all-closed", () => {
  process.platform !== "darwin" && (A.quit(), k = null);
});
let $e = !1;
A.on("before-quit", async (e) => {
  if (!$e) {
    e.preventDefault(), $e = !0;
    try {
      await tt();
    } catch {
    }
    try {
      await st();
    } catch {
    }
    A.quit();
  }
});
A.on("activate", () => {
  $.getAllWindows().length === 0 && He();
});
A.whenReady().then(He);
d.on("overlay:get-port-sync", (e) => {
  try {
    e.returnValue = ke;
  } catch {
    e.returnValue = 3620;
  }
});
d.handle("window:open-overlay-editor", async () => {
  try {
    return S && !S.isDestroyed() ? (S.show(), S.focus(), !0) : (S = Xe(), S.on("closed", () => {
      S = null;
    }), !0);
  } catch {
    return !1;
  }
});
d.handle("overlay-window:minimize", async () => {
  try {
    return S == null || S.minimize(), !0;
  } catch {
    return !1;
  }
});
d.handle("overlay-window:close", async () => {
  try {
    return S == null || S.close(), !0;
  } catch {
    return !1;
  }
});
d.handle("window:minimize", async () => {
  try {
    return k == null || k.minimize(), !0;
  } catch {
    return !1;
  }
});
d.handle("window:close", async () => {
  try {
    return k == null || k.close(), !0;
  } catch {
    return !1;
  }
});
export {
  ln as MAIN_DIST,
  Jr as RENDERER_DIST,
  Xr as VITE_DEV_SERVER_URL
};
