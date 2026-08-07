// 访问口令管理
// 与备份口令（CLOUD_PASSWORD）分离，使用 ACCESS_PASSWORD 环境变量
// 通过 sessionStorage 存储，关闭标签页即失效
// 15 分钟过期

const AUTH_KEY = 'totp_access_auth'
const AUTH_TTL = 15 * 60 * 1000 // 15 分钟

interface AuthState {
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

// 标记已验证（写入 sessionStorage）
export function markAccessAuthed(): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ timestamp: Date.now() }))
}

// 验证口令（调用后端）
export async function verifyAccessPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/kv/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.valid === true
}
