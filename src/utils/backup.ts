// 云端备份模块
// 支持 WebDAV 和 Cloudflare KV 两种备份方式

import type { TOTPAccount } from './totp'
import { loadAccounts, saveAccounts } from './db'
import { serializeBackup } from './totp'

export interface BackupConfig {
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  cloudflarePassword: string
}

const BACKUP_CFG_KEY = 'totp_backup_config'
const BACKUP_PATH = 'totp-backup.json'

// --- 备份配置 ---
export function loadBackupConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CFG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { webdavUrl: '', webdavUsername: '', webdavPassword: '', cloudflarePassword: '' }
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
  // 校验每个账户必要字段
  for (const acc of data.accounts) {
    if (!acc.secret || !acc.issuer) {
      throw new Error('备份数据中有不完整的账户条目')
    }
  }
  return data.accounts as TOTPAccount[]
}

// --- WebDAV 备份 ---
export async function backupToWebDAV(cfg: BackupConfig): Promise<string> {
  if (!cfg.webdavUrl) throw new Error('WebDAV 地址未配置')

  const accounts = loadAccounts()
  if (accounts.length === 0) throw new Error('没有可备份的账户')

  const data = serializeBackup(accounts)

  // 拼接 URL
  let baseUrl = cfg.webdavUrl.replace(/\/+$/, '')
  const url = baseUrl + '/' + BACKUP_PATH

  const auth = btoa(`${cfg.webdavUsername}:${cfg.webdavPassword}`)

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`
    },
    body: data
  })

  if (!res.ok) {
    throw new Error(`WebDAV 上传失败: ${res.status} ${res.statusText}`)
  }

  return `WebDAV 备份成功 (${accounts.length} 个账户)`
}

export async function restoreFromWebDAV(cfg: BackupConfig): Promise<{ accounts: TOTPAccount[]; message: string }> {
  if (!cfg.webdavUrl) throw new Error('WebDAV 地址未配置')

  let baseUrl = cfg.webdavUrl.replace(/\/+$/, '')
  const url = baseUrl + '/' + BACKUP_PATH

  const auth = btoa(`${cfg.webdavUsername}:${cfg.webdavPassword}`)

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` }
  })

  if (!res.ok) {
    throw new Error(`WebDAV 下载失败: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const accounts = validateBackupData(data)
  saveAccounts(accounts)
  return { accounts, message: `从 WebDAV 恢复成功 (${accounts.length} 个账户)` }
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