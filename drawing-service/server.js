import { WebSocketServer } from 'ws'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'

const port = process.env.OVERLAY_WS_PORT ? Number(process.env.OVERLAY_WS_PORT) : 3620
const server = http.createServer()
const overlayImagesDir = process.env.OVERLAY_IMAGES_DIR || ''
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const drawHtmlPath = path.join(__dirname, 'draw.html')
const overlayHtmlPath = path.join(__dirname, 'overlay.html')

// ——— Mongo client (optional) ———
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/capture'
let cachedClient = null
async function getClient() {
  if (cachedClient) return cachedClient
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  })
  await client.connect()
  cachedClient = client
  return client
}

server.on('request', (req, res) => {
  try {
    if (!req || !req.url) { res.statusCode = 400; res.end('Bad Request'); return }
    const url = new URL(req.url, `http://${req.headers.host}`)
    // API: components for render
    if (url.pathname === '/api/overlay-components') {
      const overlayId = url.searchParams.get('overlayId') || ''
      ;(async () => {
        try {
          if (!overlayId || overlayId.length < 8) throw new Error('overlayId is required')
          const client = await getClient()
          const db = client.db('capture')
          const collection = db.collection('overlay_components')
          const filter = { overlayId: new ObjectId(overlayId) }
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
            projectDetail: 1,
            dateFormat: 1,
            twentyFourHour: 1,
            useUTC: 1,
            dataType: 1,
            nodeLevel: 1,
            imagePath: 1,
            opacity: 1,
            createdAt: 1,
            updatedAt: 1,
          }
          const cursor = collection.find(filter, { projection }).sort({ createdAt: 1 })
          const raw = await cursor.toArray()
          const data = raw.map(i => ({
            _id: String(i._id),
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
            projectDetail: i.projectDetail,
            dateFormat: i.dateFormat,
            twentyFourHour: i.twentyFourHour,
            useUTC: i.useUTC,
            dataType: i.dataType,
            nodeLevel: i.nodeLevel,
            imagePath: i.imagePath,
            opacity: i.opacity,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
          }))
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: true, data }))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: message }))
        }
      })()
      return
    }
    // Static: serve overlay images
    if (url.pathname.startsWith('/images/')) {
      try {
        if (!overlayImagesDir) throw new Error('images dir not set')
        const rel = decodeURIComponent(url.pathname.replace(/^\/images\//, ''))
        const safe = rel.replace(/\\/g, '/').replace(/\.{2,}/g, '')
        const p = path.join(overlayImagesDir, safe)
        const stat = fs.statSync(p)
        if (!stat.isFile()) { res.statusCode = 404; res.end('Not Found'); return }
        const ext = path.extname(p).toLowerCase()
        const type = ext === '.png' ? 'image/png'
          : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg'
          : ext === '.webp' ? 'image/webp'
          : ext === '.bmp' ? 'image/bmp'
          : 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000' })
        fs.createReadStream(p).pipe(res)
        return
      } catch {
        res.statusCode = 404
        res.end('Not Found')
        return
      }
    }
    if (url.pathname === '/draw') {
      let html = ''
      try { html = fs.readFileSync(drawHtmlPath, 'utf8') } catch { html = '<!doctype html><meta charset="utf-8"><title>Draw</title><h1>Draw</h1>' }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    if (url.pathname === '/overlay') {
      let html = ''
      try { html = fs.readFileSync(overlayHtmlPath, 'utf8') } catch { html = '<!doctype html><meta charset="utf-8"><title>Overlay</title><h1>Overlay</h1>' }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    // default: health/info
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, service: 'drawing-service', routes: ['/draw', '/overlay'], port }))
      return
    }
    res.statusCode = 404
    res.end('Not Found')
  } catch {
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})
const wss = new WebSocketServer({ server })

// Track channel per socket
wss.on('connection', (ws, req) => {
  let ch = 0
  try {
    const u = new URL(req?.url || '', 'http://localhost')
    ch = Number(u.searchParams.get('ch') || '0') || 0
  } catch {}
  // attach a non-enumerable property to avoid accidental leaks
  try { Object.defineProperty(ws, '_ch', { value: ch, writable: false, enumerable: false }) } catch { ws._ch = ch }

  ws.on('message', (data, isBinary) => {
    // Preserve text frames as text to avoid Blob payloads in browsers
    const out = isBinary ? data : (typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data))
    for (const client of wss.clients) {
      try {
        if (client === ws) continue
        const clientCh = Number(client._ch || 0)
        if (client.readyState === 1 && clientCh === ch) {
          client.send(out, { binary: isBinary })
        }
      } catch {}
    }
  })
})

server.listen(port, () => console.log(`[browser-source-service] listening on ${port}`))


