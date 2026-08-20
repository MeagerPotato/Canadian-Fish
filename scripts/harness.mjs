#!/usr/bin/env node
/**
 * Local harness (PROTOCOL.md §1): serves ./dist statically with SPA fallback
 * and proxies /api/* to the deployed Supabase edge function, mirroring the
 * production Vercel rewrite. Plain Node, no dependencies.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const PORT = Number(process.env.PORT || 8788)
const DIST = resolve(process.cwd(), 'dist')
const UPSTREAM = 'https://fnandjtzwhihgefkfwzj.supabase.co/functions/v1/api'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', rejectPromise)
  })
}

async function proxyApi(req, res, url) {
  const target = UPSTREAM + url.pathname.slice('/api'.length) + url.search
  const headers = {}
  for (const name of ['apikey', 'authorization', 'content-type']) {
    if (req.headers[name]) headers[name] = req.headers[name]
  }
  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await readBody(req)
  const upstream = await fetch(target, init)
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  })
  if (upstream.body) {
    for await (const chunk of upstream.body) res.write(Buffer.from(chunk))
  }
  res.end()
  return upstream.status
}

async function serveStatic(res, pathname) {
  let filePath = normalize(join(DIST, pathname === '/' ? 'index.html' : pathname))
  if (!filePath.startsWith(DIST)) filePath = join(DIST, 'index.html')
  let body
  try {
    body = await readFile(filePath)
  } catch {
    filePath = join(DIST, 'index.html') // SPA fallback
    body = await readFile(filePath)
  }
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  res.end(body)
  return 200
}

const server = createServer(async (req, res) => {
  const started = Date.now()
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  let status = 500
  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      status = await proxyApi(req, res, url)
    } else {
      status = await serveStatic(res, url.pathname)
    }
  } catch (err) {
    status = 502
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: { code: 'UPSTREAM', message: String(err) } }))
  }
  console.log(`${req.method} ${url.pathname}${url.search} -> ${status} (${Date.now() - started}ms)`)
})

server.listen(PORT, () => {
  console.log(`harness: serving ${DIST} on http://localhost:${PORT}, /api/* -> ${UPSTREAM}`)
})
