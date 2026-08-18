// Cloudflare Pages Functions 入口
// 处理 /api/kv/backup 的请求
// 复用 AUTH_USERNAME + AUTH_PASSWORD 凭据（与登录同一套）

interface Env {
  TOTP_KV: KVNamespace
  AUTH_USERNAME: string
  AUTH_PASSWORD: string
}

// 安全字符串比较（防止时序攻击）
function safeEqual(a: string, b: string): boolean {
  // 始终比较到较长字符串的长度，避免通过响应时间泄露长度信息
  const maxLen = Math.max(a.length, b.length)
  let result = a.length ^ b.length // 长度不同时 result != 0
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
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

// 凭据验证（默认拒绝）
function checkCredentials(request: Request, env: Env): boolean {
  const username = request.headers.get('X-Auth-Username') || ''
  const password = request.headers.get('X-Auth-Password') || ''
  const envUsername = env.AUTH_USERNAME
  const envPassword = env.AUTH_PASSWORD
  // 未设置环境变量时拒绝所有请求
  if (!envUsername || !envPassword) return false
  if (!username || !password) return false
  return safeEqual(username, envUsername) && safeEqual(password, envPassword)
}

// CORS 头 — 允许所有来源，方便其他人部署
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Username, X-Auth-Password'
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

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // 验证凭据（在限流之前，避免已认证用户被误限）
  if (!checkCredentials(request, env)) {
    // 凭据错误时才计入限流
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'too_many_attempts' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }
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
