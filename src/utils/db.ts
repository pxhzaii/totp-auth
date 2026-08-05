// 本地存储管理
import type { TOTPAccount } from './totp'
import { encryptSecret, decryptSecret } from './totp'

const STORAGE_KEY = 'totp_accounts'
const MASTER_KEY_KEY = 'totp_master_key'

// 每次启动时生成一个随机主密钥，用于加密本地存储的密钥
// 密钥保存在 localStorage 中，避免密钥明文泄露
function getOrCreateMasterKey(): string {
  let key = localStorage.getItem(MASTER_KEY_KEY)
  if (!key) {
    key = Array.from({ length: 32 }, () =>
      Math.random().toString(36)[2]
    ).join('')
    localStorage.setItem(MASTER_KEY_KEY, key)
  }
  return key
}

export function loadAccounts(): TOTPAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const masterKey = getOrCreateMasterKey()
    const decrypted = decryptSecret(raw, masterKey)
    const accounts = JSON.parse(decrypted) as TOTPAccount[]
    return accounts.sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}

export function saveAccounts(accounts: TOTPAccount[]): void {
  const masterKey = getOrCreateMasterKey()
  const plaintext = JSON.stringify(accounts)
  const encrypted = encryptSecret(plaintext, masterKey)
  localStorage.setItem(STORAGE_KEY, encrypted)
}

export function addAccount(account: TOTPAccount): void {
  const accounts = loadAccounts()
  accounts.push(account)
  saveAccounts(accounts)
}

export function updateAccount(account: TOTPAccount): void {
  const accounts = loadAccounts()
  const idx = accounts.findIndex(a => a.id === account.id)
  if (idx >= 0) {
    accounts[idx] = account
    saveAccounts(accounts)
  }
}

export function deleteAccount(id: string): void {
  const accounts = loadAccounts()
  const filtered = accounts.filter(a => a.id !== id)
  saveAccounts(filtered)
}

export function reorderAccounts(ids: string[]): void {
  const accounts = loadAccounts()
  const map = new Map(accounts.map(a => [a.id, a]))
  const reordered = ids
    .map((id, idx) => {
      const a = map.get(id)
      if (a) {
        a.order = idx
        return a
      }
      return null
    })
    .filter(Boolean) as TOTPAccount[]
  saveAccounts(reordered)
}

export function clearAllAccounts(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getAccountCount(): number {
  return loadAccounts().length
}