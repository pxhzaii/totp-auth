// 云端备份模块
// 仅支持 Cloudflare KV 备份
// 凭据从 sessionStorage 获取（与登录同一套账号密码）

import type { TOTPAccount } from './totp'
import { loadAccounts, saveAccounts } from './db'
import { serializeBackup } from './totp'
import { getAuthedCredentials } from './auth'

// --- 数据校验 ---
function validateBackupData(data: any): TOTPAccount[] {
  if (!data || typeof data !== 'object') {
    throw new Error('备份数据格式无效')
  }
  if (!Array.isArray(data.accounts)) {
    throw new Error('备份数据缺少 accounts 字段')
  }
  if (data.accounts.length === 0) {
    throw new Error('备份数据为空，没有可恢复的账户')
  }
  const validAccounts: TOTPAccount[] = []
  for (const acc of data.accounts) {
    if (!acc || typeof acc !== 'object') continue
    // 必须有 secret 和至少 issuer 或 account 之一
    if (typeof acc.secret !== 'string' || !acc.secret) continue
    if (typeof acc.issuer !== 'string' && typeof acc.account !== 'string') continue
    validAccounts.push({
      id: typeof acc.id === 'string' && acc.id ? acc.id : crypto.randomUUID(),
      issuer: typeof acc.issuer === 'string' ? acc.issuer : '未命名',
      account: typeof acc.account === 'string' ? acc.account : '',
      secret: acc.secret,
      period: typeof acc.period === 'number' ? acc.period : 30,
      digits: typeof acc.digits === 'number' ? acc.digits : 6,
      createdAt: typeof acc.createdAt === 'number' ? acc.createdAt : Date.now(),
      order: typeof acc.order === 'number' ? acc.order : Date.now()
    })
  }
  if (validAccounts.length === 0) {
    throw new Error('备份数据中没有有效的账户条目')
  }
  return validAccounts
}

// 获取凭据，未登录时抛出错误
function requireCredentials(): { username: string; password: string } {
  const creds = getAuthedCredentials()
  if (!creds) throw new Error('请先登录后再进行备份操作')
  return creds
}

// --- Cloudflare KV 备份 ---
export async function backupToKV(): Promise<string> {
  const creds = requireCredentials()

  const accounts = loadAccounts()
  if (accounts.length === 0) throw new Error('没有可备份的账户')

  const data = serializeBackup(accounts)

  const res = await fetch('/api/kv/backup', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Username': creds.username,
      'X-Auth-Password': creds.password
    },
    body: data
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`KV 备份失败: ${res.status} ${err}`)
  }

  return `KV 备份成功 (${accounts.length} 个账户)`
}

export async function restoreFromKV(): Promise<{ accounts: TOTPAccount[]; message: string }> {
  const creds = requireCredentials()

  const res = await fetch('/api/kv/backup', {
    headers: {
      'X-Auth-Username': creds.username,
      'X-Auth-Password': creds.password
    }
  })

  if (!res.ok) {
    const err = await res.text()
    if (res.status === 404) throw new Error('KV 中没有备份数据')
    throw new Error(`KV 恢复失败: ${res.status} ${err}`)
  }

  const data = await res.json()
  const accounts = validateBackupData(data)
  saveAccounts(accounts)
  return { accounts, message: `从 KV 恢复成功 (${accounts.length} 个账户)` }
}
