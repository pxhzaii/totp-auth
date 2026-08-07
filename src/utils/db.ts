// 本地存储管理
import type { TOTPAccount } from './totp'

const STORAGE_KEY = 'totp_accounts'

export function loadAccounts(): TOTPAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const accounts = JSON.parse(raw) as TOTPAccount[]
    return accounts.sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}

export function saveAccounts(accounts: TOTPAccount[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
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