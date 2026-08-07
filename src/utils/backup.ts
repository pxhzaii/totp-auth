// 云端备份模块
// 仅支持 Cloudflare KV 备份

import type { TOTPAccount } from './totp'
import { loadAccounts, saveAccounts } from './db'
import { serializeBackup } from './totp'

export interface BackupConfig {
  cloudflarePassword: string
}

const BACKUP_CFG_KEY = 'totp_backup_config'

// --- 备份配置 ---
export function loadBackupConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CFG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { cloudflarePassword: '' }
}

export function saveBackupConfig(cfg: BackupConfig): void {
  localStorage.setItem(BACKUP_CFG_KEY, JSON.stringify(cfg))
}

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
      issuer: acc.issuer || '未命名',
      account: acc.account || '',
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

// --- Cloudflare KV 备份 ---
export async function backupToKV(cfg: BackupConfig): Promise<string> {
  if (!cfg.cloudflarePassword) throw new Error('Cloudflare 访问口令未配置')

  const accounts = loadAccounts()
  if (accounts.length === 0) throw new Error('没有可备份的账户')

  const data = serializeBackup(accounts)

  const res = await fetch('/api/kv/backup', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Cloud-Password': cfg.cloudflarePassword
    },
    body: data
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`KV 备份失败: ${res.status} ${err}`)
  }

  return `KV 备份成功 (${accounts.length} 个账户)`
}

export async function restoreFromKV(cfg: BackupConfig): Promise<{ accounts: TOTPAccount[]; message: string }> {
  if (!cfg.cloudflarePassword) throw new Error('Cloudflare 访问口令未配置')

  const res = await fetch('/api/kv/backup', {
    headers: { 'X-Cloud-Password': cfg.cloudflarePassword }
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
