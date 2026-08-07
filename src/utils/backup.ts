// 云端备份模块
// 支持 WebDAV 和 Cloudflare KV 两种备份方式

import type { TOTPAccount } from './totp'
import { loadAccounts, saveAccounts } from './db'
import { serializeBackup } from './totp'

export interface BackupConfig {
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavProxy: string   // 代理地址，为空则直连
  cloudflarePassword: string
}

const BACKUP_CFG_KEY = 'totp_backup_config'
const BACKUP_PATH = 'totp-backup.json'

// --- 代理预设 ---
export interface ProxyOption {
  label: string
  value: string  // 代理地址，空字符串表示直连
}

export const PROXY_PRESETS: ProxyOption[] = [
  { label: '直连（不使用代理）', value: '' },
  { label: 'Vercel 代理（keyvault-webdav-proxy）', value: '__custom__' },
]

// --- 备份配置 ---
export function loadBackupConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CFG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    webdavUrl: 'https://dav.jianguoyun.com/dav/',
    webdavUsername: '',
    webdavPassword: '',
    webdavProxy: '',
    cloudflarePassword: '',
  }
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

// --- WebDAV 代理请求封装 ---
// 代理格式：Vercel function，GET/HEAD 返回 { status, headers, bodyB64 }
// 其他方法返回 { status, headers }
async function webdavFetch(
  cfg: BackupConfig,
  method: 'GET' | 'PUT',
  body?: string
): Promise<{ status: number; data: any }> {
  let baseUrl = cfg.webdavUrl.replace(/\/+$/, '')
  const targetUrl = baseUrl + '/' + BACKUP_PATH
  const auth = btoa(`${cfg.webdavUsername}:${cfg.webdavPassword}`)

  if (cfg.webdavProxy) {
    // 走代理：proxy?url=xxx&method=xxx
    const proxyBase = cfg.webdavProxy.replace(/\/+$/, '')
    const proxyUrl = `${proxyBase}/api/webdav?url=${encodeURIComponent(targetUrl)}&method=${method}`

    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
    }
    const fetchOpts: RequestInit = { method: 'GET', headers }  // 代理始终用 GET，method 参数指定实际方法

    if (body) {
      headers['Content-Type'] = 'application/json'
      fetchOpts.body = body
    }

    const res = await fetch(proxyUrl, fetchOpts)
    const json = await res.json()

    if (json.error) {
      throw new Error(`代理错误: ${json.error}`)
    }

    // 代理返回的 status
    const status = json.status as number

    if (method === 'GET') {
      // bodyB64 解码
      if (json.bodyB64) {
        const decoded = atob(json.bodyB64)
        const data = JSON.parse(decoded)
        return { status, data }
      }
      return { status, data: null }
    }

    // PUT 等写入操作，代理不返回 body
    return { status, data: null }
  } else {
    // 直连
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
    }
    const fetchOpts: RequestInit = { method, headers }

    if (body) {
      headers['Content-Type'] = 'application/json'
      fetchOpts.body = body
    }

    const res = await fetch(targetUrl, fetchOpts)

    if (!res.ok) {
      throw new Error(`WebDAV ${method === 'PUT' ? '上传' : '下载'}失败: ${res.status} ${res.statusText}`)
    }

    if (method === 'GET') {
      const data = await res.json()
      return { status: res.status, data }
    }

    return { status: res.status, data: null }
  }
}

// --- WebDAV 备份 ---
export async function backupToWebDAV(cfg: BackupConfig): Promise<string> {
  if (!cfg.webdavUrl) throw new Error('WebDAV 地址未配置')

  const accounts = loadAccounts()
  if (accounts.length === 0) throw new Error('没有可备份的账户')

  const data = serializeBackup(accounts)

  const result = await webdavFetch(cfg, 'PUT', data)

  if (cfg.webdavProxy) {
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`WebDAV 上传失败 (via 代理): HTTP ${result.status}`)
    }
  }

  return `WebDAV 备份成功 (${accounts.length} 个账户)`
}

export async function restoreFromWebDAV(cfg: BackupConfig): Promise<{ accounts: TOTPAccount[]; message: string }> {
  if (!cfg.webdavUrl) throw new Error('WebDAV 地址未配置')

  const result = await webdavFetch(cfg, 'GET')

  if (cfg.webdavProxy) {
    if (result.status === 404) throw new Error('WebDAV 上没有备份数据')
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`WebDAV 下载失败 (via 代理): HTTP ${result.status}`)
    }
  }

  const accounts = validateBackupData(result.data)
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
