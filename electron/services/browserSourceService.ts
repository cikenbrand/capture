import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import { app } from 'electron'
import { OVERLAY_WS_PORT } from '../settings'

let browserSourceProc: ChildProcess | null = null
let currentPort: number | null = null

function resolveServerPath() {
  const appRoot = process.env.APP_ROOT || path.join(__dirname, '..', '..')
  return path.join(appRoot, 'drawing-service', 'server.js')
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
    if (browserSourceProc) return true
    const resolvedPort = Number(port || OVERLAY_WS_PORT || 3620) || 3620
    const serverPath = resolveServerPath()
    // Resolve images directory under Electron userData
    let overlayImagesDir = ''
    try { overlayImagesDir = path.join(app.getPath('userData'), 'overlay-images') } catch { overlayImagesDir = '' }

    // Spawn with system Node. In dev, Node should be in PATH.
    // In prod, ensure browser source service is packaged alongside app.
    const cmd = process.platform === 'win32' ? 'node.exe' : 'node'
    browserSourceProc = spawn(cmd, [serverPath], {
      cwd: path.dirname(serverPath),
      env: { ...process.env, OVERLAY_WS_PORT: String(resolvedPort), OVERLAY_IMAGES_DIR: overlayImagesDir },
      stdio: 'ignore',
      detached: false,
    })

    browserSourceProc.on('exit', (code, signal) => {
      try { console.log(`[browser-source-service] exited code=${code} signal=${signal}`) } catch {}
      browserSourceProc = null
      currentPort = null
    })

    currentPort = resolvedPort

    // Wait briefly for readiness
    const ok = await waitForHealth(resolvedPort, 5000)
    if (!ok) {
      try { console.warn('[browser-source-service] did not become healthy in time') } catch {}
    }
    return true
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
    if (!p) return
    try { p.kill() } catch {}
  } catch {}
}

export {}


