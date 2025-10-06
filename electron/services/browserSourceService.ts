import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import http from 'node:http'
import { app } from 'electron'
import { OVERLAY_WS_PORT } from '../settings'

let browserSourceProc: ChildProcess | null = null
let browserSourceInProcess = false
let currentPort: number | null = null

function resolveServerPath() {
  const appRoot = process.env.APP_ROOT || path.join(__dirname, '..', '..')
  // When asar is enabled, the drawing-service folder may be inside the asar archive
  // Electron can execute JS inside asar when using ELECTRON_RUN_AS_NODE, but if it is unpacked,
  // prefer the unpacked path for file I/O (serving HTML).
  const asarPath = path.join(appRoot, 'drawing-service', 'server.js')
  const unpackedPath = asarPath.replace(/\.asar(\\|\/)/, '.asar.unpacked$1')
  try {
    return require('fs').existsSync(unpackedPath) ? unpackedPath : asarPath
  } catch {
    return asarPath
  }
}

function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const tryOnce = () => {
      try {
        const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 1000 }, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { res.resume() } catch {}
            resolve(true)
          } else {
            try { res.resume() } catch {}
            if (Date.now() >= deadline) return resolve(false)
            setTimeout(tryOnce, 300)
          }
        })
        req.on('error', () => {
          if (Date.now() >= deadline) return resolve(false)
          setTimeout(tryOnce, 300)
        })
        req.on('timeout', () => {
          try { req.destroy() } catch {}
          if (Date.now() >= deadline) return resolve(false)
          setTimeout(tryOnce, 300)
        })
      } catch {
        if (Date.now() >= deadline) return resolve(false)
        setTimeout(tryOnce, 300)
      }
    }
    tryOnce()
  })
}

export async function startBrowserSourceService(port?: number): Promise<boolean> {
  try {
    if (browserSourceProc || browserSourceInProcess) return true
    const resolvedPort = Number(port || OVERLAY_WS_PORT || 3620) || 3620
    const serverPath = resolveServerPath()
    // Resolve images directory under Electron userData
    let overlayImagesDir = ''
    try { overlayImagesDir = path.join(app.getPath('userData'), 'overlay-images') } catch { overlayImagesDir = '' }

    // Prefer in-process dynamic import to avoid spawning the app exe on Windows
    // Set env for the module before import
    process.env.OVERLAY_WS_PORT = String(resolvedPort)
    process.env.OVERLAY_IMAGES_DIR = overlayImagesDir
    try {
      const url = pathToFileURL(serverPath).href
      await import(url)
      browserSourceInProcess = true
      currentPort = resolvedPort
      const ok = await waitForHealth(resolvedPort, 5000)
      if (!ok) {
        try { console.warn('[browser-source-service] did not become healthy in time') } catch {}
      }
      return true
    } catch (impErr) {
      // Fallback: spawn using Electron's embedded runtime
      const exec = process.execPath
      const args = [serverPath]
      browserSourceProc = spawn(exec, args, {
        cwd: path.dirname(serverPath),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OVERLAY_WS_PORT: String(resolvedPort), OVERLAY_IMAGES_DIR: overlayImagesDir },
        stdio: 'ignore',
        detached: false,
      })

      browserSourceProc.on('exit', (code, signal) => {
        try { console.log(`[browser-source-service] exited code=${code} signal=${signal}`) } catch {}
        browserSourceProc = null
        currentPort = null
      })

      currentPort = resolvedPort
      const ok = await waitForHealth(resolvedPort, 5000)
      if (!ok) {
        try { console.warn('[browser-source-service] did not become healthy in time') } catch {}
      }
      return true
    }
  } catch (err) {
    try { console.error('[browser-source-service] failed to start:', err) } catch {}
    return false
  }
}

export async function stopBrowserSourceService(): Promise<void> {
  try {
    const p = browserSourceProc
    browserSourceProc = null
    currentPort = null
    browserSourceInProcess = false
    if (!p) return
    try { p.kill() } catch {}
  } catch {}
}

export {}


