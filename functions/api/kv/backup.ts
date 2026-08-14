// Cloudflare Pages Functions 入口
// 处理 /api/kv/backup 的请求

interface Env {
  TOTP_KV: KVNamespace
  CLOUD_PASSWORD: string
}

// 安全字符串比较（防止时序攻击）
function safeEqual(a: string, b: string): boolean {
  // 始终比较到较长字符串的长度，避免通过响应时间泄露长度信息
  const maxLen = Math.max(a.length, b.length)
  let result = a.length ^ b.length // 长度不同时 result != 0
  for (let i = 0; i < maxLen; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// --- 限流（基于 IP，10 次/15 分钟）---
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW = 15 * 60 * 1000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW }
    rateLimitMap.set(ip, entry)
  }
  entry.count++
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
  return entry.count > RATE_LIMIT_MAX
}

// 密码验证（默认拒绝）
function checkPassword(request: Request, env: Env): boolean {
  const password = request.headers.get('X-Cloud-Password') || ''
  const envPassword = env.CLOUD_PASSWORD
  // 未设置密码环境变量时拒绝所有请求
  if (!envPassword) return false
  if (!password) return false
  return safeEqual(password, envPassword)
}

// CORS 头 — 限制为同源，不允许第三方网站访问
function getCorsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cloud-Password',
    'Vary': 'Origin'  // 告诉 CDN 不要按 Origin 缓存，每个 Origin 单独缓存
  }
  // 只允许同源请求；如果 Origin 为空（同源请求/非浏览器），放行
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      ...baseHeaders
    }
  }
  // 对于跨域请求，仅允许与部署域名同源的请求
  // 生产环境中应替换为你的实际域名
  const allowedOrigins = [
    'https://totp.5as.cn',  // 部署域名
    'http://localhost:8788'  // 本地开发
  ]
  const allowOrigin = allowedOrigins.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    ...baseHeaders
  }
}

function jsonResponse(data: any, status = 200, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(message, {
    status,
    headers: corsHeaders
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname
  const corsHeaders = getCorsHeaders(request)

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // 限流检查
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'too_many_attempts' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  // 验证密码
  if (!checkPassword(request, env)) {
    return errorResponse('Unauthorized', 401, corsHeaders)
  }

  // 路由: /api/kv/backup
  if (path === '/api/kv/backup') {
    const KV_KEY = 'totp_backup_data'

    if (request.method === 'PUT') {
      // 上传备份 — 校验 body 为合法 JSON
      try {
        const body = await request.text()
        let parsed: any
        try {
          parsed = JSON.parse(body)
        } catch {
          return errorResponse('请求 body 不是合法 JSON', 400, corsHeaders)
        }
        // 基本结构校验
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.accounts)) {
          return errorResponse('备份数据缺少 accounts 数组', 400, corsHeaders)
        }
        // 限制账户数量（KV value 最大 25MB，实际远达不到，但防止滥用）
        if (parsed.accounts.length > 1000) {
          return errorResponse('账户数量超过限制 (1000)', 400, corsHeaders)
        }
        await env.TOTP_KV.put(KV_KEY, body)
        return jsonResponse({ success: true, message: '备份成功' }, 200, corsHeaders)
      } catch (e: any) {
        return errorResponse(`备份失败: ${e.message}`, 500, corsHeaders)
      }
    }

    if (request.method === 'GET') {
      // 获取备份
      try {
        const data = await env.TOTP_KV.get(KV_KEY)
        if (!data) {
          return errorResponse('No backup found', 404, corsHeaders)
        }
        const parsed = JSON.parse(data)
        if (!parsed || typeof parsed !== 'object') {
          return errorResponse('备份数据格式损坏', 500, corsHeaders)
        }
        return jsonResponse(parsed, 200, corsHeaders)
      } catch (e: any) {
        return errorResponse(`恢复失败: ${e.message}`, 500, corsHeaders)
      }
    }

    if (request.method === 'DELETE') {
      // 删除备份
      try {
        await env.TOTP_KV.delete(KV_KEY)
        return jsonResponse({ success: true, message: '已删除备份' }, 200, corsHeaders)
      } catch (e: any) {
        return errorResponse(`删除失败: ${e.message}`, 500, corsHeaders)
      }
    }
  }

  return errorResponse('Not Found', 404, corsHeaders)
}
