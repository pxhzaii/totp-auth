// 访问凭据管理
// 使用 AUTH_USERNAME + AUTH_PASSWORD 环境变量（账号+密码形式）
// 通过 sessionStorage 存储已验证的账号密码，关闭标签页即失效
// 15 分钟过期

const AUTH_KEY = 'totp_access_auth'
const AUTH_TTL = 15 * 60 * 1000 // 15 分钟

interface AuthState {
  username: string
  password: string
  timestamp: number
}

// 检查本地缓存是否仍有效
export function isAccessAuthed(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return false
    const state: AuthState = JSON.parse(raw)
    if (Date.now() - state.timestamp > AUTH_TTL) {
      sessionStorage.removeItem(AUTH_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

// 获取已缓存的凭据（用于备份 API）
export function getAuthedCredentials(): { username: string; password: string } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const state: AuthState = JSON.parse(raw)
    if (Date.now() - state.timestamp > AUTH_TTL) {
      sessionStorage.removeItem(AUTH_KEY)
      return null
    }
    return { username: state.username, password: state.password }
  } catch {
    return null
  }
}

// 标记已验证（写入 sessionStorage）
export function markAccessAuthed(username: string, password: string): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ username, password, timestamp: Date.now() }))
}

// 验证账号密码（调用后端）
export async function verifyAccessPassword(username: string, password: string): Promise<{ valid: boolean; error?: string }> {
  const res = await fetch('/api/kv/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (res.status === 429) {
    return { valid: false, error: '尝试次数过多，请 15 分钟后再试' }
  }
  if (!res.ok) return { valid: false, error: '验证失败，请检查网络连接' }
  const data = await res.json()
  if (data.error === 'not_configured') {
    return { valid: false, error: '服务端未设置账号密码环境变量，请联系管理员' }
  }
  return { valid: data.valid === true }
}
