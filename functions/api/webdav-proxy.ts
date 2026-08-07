// Cloudflare Pages Function — WebDAV CORS 反向代理
// 绕过 Cloudflare-to-Cloudflare 520 问题
// 限制：域名白名单 + 速率限制

interface Env {
  TOTP_KV: KVNamespace
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS, PROPFIND, MKCOL',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination',
  'Access-Control-Expose-Headers': 'DAV, Content-Length, ETag',
  'Access-Control-Max-Age': '86400',
}

// 允许的 WebDAV 目标域名白名单
// 部署时可通过环境变量 WEBDAV_ALLOWED_DOMAINS 覆盖（逗号分隔）
const DEFAULT_ALLOWED_DOMAINS = [
  'dav.jianguoyun.com',        // 坚果云
  'webdav.pcloud.com',         // pCloud
  'webdav.hidrive.strato.com', // HiDrive
  'dav.infini-cloud.net',      // InfiniCLOUD
]

// 速率限制
const RATE_LIMIT = { max: 60, window: 60 }

function getAllowedDomains(env: Env): string[] {
  const envVal = (env as any).WEBDAV_ALLOWED_DOMAINS
  if (envVal) {
    return envVal.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean)
  }
  return DEFAULT_ALLOWED_DOMAINS
}

function isDomainAllowed(urlStr: string, env: Env): boolean {
  try {
    const target = new URL(urlStr)
    if (target.protocol !== 'https:') return false
    const hostname = target.hostname.toLowerCase()
    const allowed = getAllowedDomains(env)
    return allowed.some(d => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

// KV 速率限制
async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `ratelimit:webdav:${ip}`
  const now = Math.floor(Date.now() / 1000)
  let stored: { start: number; count: number } | null = null
  try {
    const raw = await env.TOTP_KV.get(key, 'json')
    if (raw) stored = raw as any
  } catch {}

  if (!stored || now - stored.start > RATE_LIMIT.window) {
    await env.TOTP_KV.put(key, JSON.stringify({ start: now, count: 1 }), { expirationTtl: RATE_LIMIT.window + 10 })
    return true
  }
  stored.count++
  if (stored.count > RATE_LIMIT.max) return false
  await env.TOTP_KV.put(key, JSON.stringify(stored), { expirationTtl: RATE_LIMIT.window + 10 })
  return true
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // 速率限制
  const clientIp = request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!await checkRateLimit(clientIp, env)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 60 requests/minute.' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const targetUrl = url.searchParams.get('url')
  const realMethod = url.searchParams.get('method') || 'GET'

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 域名白名单校验
  if (!isDomainAllowed(targetUrl, env)) {
    let hostname = ''
    try { hostname = new URL(targetUrl).hostname } catch {}
    return new Response(JSON.stringify({
      error: `Domain "${hostname}" is not in the allowed WebDAV whitelist.`,
      hint: 'Set WEBDAV_ALLOWED_DOMAINS env var or modify DEFAULT_ALLOWED_DOMAINS in source.',
      allowedDomains: getAllowedDomains(env),
    }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 转发请求头
  const headers = new Headers()
  // 伪装 User-Agent，避免目标站 WAF 拦截
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
  headers.set('Accept', '*/*')
  headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8')
  const forwardHeaders = ['authorization', 'content-type', 'depth', 'if-match', 'if-none-match', 'overwrite', 'destination']
  for (const key of forwardHeaders) {
    const val = request.headers.get(key)
    if (val) headers.set(key, val)
  }

  const init: RequestInit = {
    method: realMethod,
    headers,
    redirect: 'follow',
  }

  // 写操作转发 body
  if (['POST', 'PUT', 'PATCH'].includes(realMethod)) {
    try {
      const bodyBuf = await request.arrayBuffer()
      if (bodyBuf.byteLength > 0) init.body = bodyBuf
    } catch { /* no body */ }
  }

  try {
    const resp = await fetch(targetUrl, init)
    const body = await resp.arrayBuffer()

    const respHeaders = new Headers()
    const safeHeaders = ['content-type', 'dav', 'etag', 'last-modified', 'content-length']
    for (const key of safeHeaders) {
      const val = resp.headers.get(key)
      if (val) respHeaders.set(key, val)
    }
    for (const [k, v] of Object.entries(CORS)) {
      respHeaders.set(k, v)
    }

    return new Response(body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + (err?.message || String(err)) }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
