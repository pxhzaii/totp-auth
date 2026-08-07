// TOTP 核心算法实现 (RFC 6238 / RFC 4226)
// 纯浏览器端实现，无需任何外部依赖

// --- Base32 编解码 ---
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(secret: string): Uint8Array {
  const cleaned = secret.replace(/[^A-Za-z2-7]/g, '').toUpperCase()
  const bits: number[] = []
  for (const ch of cleaned) {
    const idx = BASE32_CHARS.indexOf(ch)
    if (idx === -1) continue
    for (let i = 4; i >= 0; i--) {
      bits.push((idx >> i) & 1)
    }
  }
  const bytes: number[] = []
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j]
    }
    bytes.push(byte)
  }
  return new Uint8Array(bytes)
}

export function base32Encode(data: Uint8Array): string {
  const bits: number[] = []
  for (const b of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1)
    }
  }
  const result: string[] = []
  for (let i = 0; i + 4 < bits.length; i += 5) {
    let idx = 0
    for (let j = 0; j < 5; j++) {
      idx = (idx << 1) | (bits[i + j] || 0)
    }
    result.push(BASE32_CHARS[idx])
  }
  return result.join('')
}

// --- HMAC-SHA1 ---
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message)
  return new Uint8Array(sig)
}

// --- 动态截断 (DT) ---
function dynamicTruncate(hs: Uint8Array): number {
  const offset = hs[19] & 0x0f
  const code = ((hs[offset] & 0x7f) << 24) |
    ((hs[offset + 1] & 0xff) << 16) |
    ((hs[offset + 2] & 0xff) << 8) |
    (hs[offset + 3] & 0xff)
  return code
}

// --- HOTP ---
async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {
  const msg = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const hs = await hmacSha1(secret, msg)
  const snum = dynamicTruncate(hs)
  const code = snum % Math.pow(10, digits)
  return code.toString().padStart(digits, '0')
}

// --- TOTP ---
export async function generateTOTP(
  secretBase32: string,
  period = 30,
  digits = 6
): Promise<{ code: string; remaining: number; progress: number }> {
  const key = base32Decode(secretBase32)
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / period)
  const elapsed = now - counter * period
  const remaining = period - elapsed
  const progress = elapsed / period

  const code = await hotp(key, counter, digits)
  return { code, remaining, progress }
}

// --- 生成随机密钥 ---
export function generateRandomSecret(length = 20): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

// --- 生成 otpauth URL ---
export function generateOTPAuthURL(
  secret: string,
  issuer: string,
  account: string,
  period = 30,
  digits = 6
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedAccount = encodeURIComponent(account)
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${digits}&period=${period}`
}

// --- 校验 TOTP 码 (允许时间偏移) ---
export async function verifyTOTP(
  secretBase32: string,
  code: string,
  period = 30,
  digits = 6,
  window = 1
): Promise<boolean> {
  const key = base32Decode(secretBase32)
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / period)

  for (let i = -window; i <= window; i++) {
    const c = await hotp(key, counter + i, digits)
    if (c === code) return true
  }
  return false
}

// --- 账户存储类型 ---
export interface TOTPAccount {
  id: string
  issuer: string
  account: string
  secret: string
  period: number
  digits: number
  createdAt: number
  order: number
  icon?: string
}

// --- 序列化 / 反序列化 (用于备份) ---
export interface BackupData {
  version: number
  exportedAt: number
  accounts: TOTPAccount[]
}

export function serializeBackup(accounts: TOTPAccount[]): string {
  const data: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    accounts
  }
  return JSON.stringify(data, null, 2)
}