// 访问口令验证端点
// 与 CLOUD_PASSWORD（备份口令）分离，使用 ACCESS_PASSWORD 环境变量

interface Env {
  ACCESS_PASSWORD: string
}

// 安全字符串比较（防止时序攻击）
function safeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  let result = a.length ^ b.length
  for (let i = 0; i < maxLen; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// --- 限流（基于 IP，5 次/15 分钟）---
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 分钟
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW }
    rateLimitMap.set(ip, entry)
  }
  entry.count++
  // 定期清理过期条目（防止内存泄漏）
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
  return entry.count > RATE_LIMIT_MAX
}

// CORS 头 — 与 backup.ts 一致，限制为同源
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || ''
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  }
  if (!origin) {
    return { 'Access-Control-Allow-Origin': '*', ...baseHeaders }
  }
  const allowedOrigins = [
    'https://totp.5as.cn',
    'http://localhost:8788'
  ]
  const allowOrigin = allowedOrigins.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    ...baseHeaders
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = getCorsHeaders(request)

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  // 限流检查
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ valid: false, error: 'too_many_attempts' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  const envPassword = env.ACCESS_PASSWORD

  // 未设置访问口令，直接放行（不启用访问保护）
  if (!envPassword) {
    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  try {
    const body = await request.json() as { password?: string }
    const password = body.password || ''

    if (!password) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    const valid = safeEqual(password, envPassword)

    return new Response(JSON.stringify({ valid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}
