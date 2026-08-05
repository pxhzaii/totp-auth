// Cloudflare Pages Functions 入口
// 处理 /api/kv/backup 的请求

interface Env {
  TOTP_KV: KVNamespace
}

// 密码验证
function checkPassword(request: Request, env: Env): boolean {
  const password = request.headers.get('X-Cloud-Password')
  const envPassword = env.CLOUD_PASSWORD
  if (!envPassword) return true // 未设置密码时允许所有请求
  return password === envPassword
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Cloud-Password'
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

function errorResponse(message: string, status: number): Response {
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

  // 验证密码
  if (!checkPassword(request, env)) {
    return errorResponse('Unauthorized', 401)
  }

  // 路由: /api/kv/backup
  if (path === '/api/kv/backup') {
    const KV_KEY = 'totp_backup_data'

    if (request.method === 'PUT') {
      // 上传备份
      try {
        const body = await request.text()
        await env.TOTP_KV.put(KV_KEY, body)
        return jsonResponse({ success: true, message: '备份成功' })
      } catch (e: any) {
        return errorResponse(`备份失败: ${e.message}`, 500)
      }
    }

    if (request.method === 'GET') {
      // 获取备份
      try {
        const data = await env.TOTP_KV.get(KV_KEY)
        if (!data) {
          return errorResponse('No backup found', 404)
        }
        const parsed = JSON.parse(data)
        return jsonResponse(parsed)
      } catch (e: any) {
        return errorResponse(`恢复失败: ${e.message}`, 500)
      }
    }

    if (request.method === 'DELETE') {
      // 删除备份
      try {
        await env.TOTP_KV.delete(KV_KEY)
        return jsonResponse({ success: true, message: '已删除备份' })
      } catch (e: any) {
        return errorResponse(`删除失败: ${e.message}`, 500)
      }
    }
  }

  return errorResponse('Not Found', 404)
}