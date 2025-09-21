import { WebSocketServer } from 'ws'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const port = process.env.OVERLAY_WS_PORT ? Number(process.env.OVERLAY_WS_PORT) : 3620
const server = http.createServer()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const drawHtmlPath = path.join(__dirname, 'draw.html')

server.on('request', (req, res) => {
  try {
    if (!req || !req.url) { res.statusCode = 400; res.end('Bad Request'); return }
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname === '/draw') {
      let html = ''
      try { html = fs.readFileSync(drawHtmlPath, 'utf8') } catch { html = '<!doctype html><meta charset="utf-8"><title>Draw</title><h1>Draw</h1>' }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    // default: health/info
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, service: 'drawing-service', port }))
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

wss.on('connection', (ws) => {
  ws.on('message', (data, isBinary) => {
    // Preserve text frames as text to avoid Blob payloads in browsers
    const out = isBinary ? data : (typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data))
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1) client.send(out, { binary: isBinary })
    }
  })
})

server.listen(port, () => console.log(`[drawing-service] listening on ${port}`))


