<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- 数据导出 -->
        <section class="section">
          <h3 class="section-title">数据管理</h3>
          <div class="section-actions">
            <button class="action-row" @click="exportData">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">导出数据</span>
                <span class="action-desc">将所有账户导出为 JSON 文件</span>
              </div>
            </button>
            <button class="action-row" @click="importData">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">导入数据</span>
                <span class="action-desc">从 JSON 文件恢复账户</span>
              </div>
            </button>
          </div>
        </section>

        <!-- Cloudflare KV 备份 -->
        <section class="section">
          <h3 class="section-title">Cloudflare KV 备份</h3>
          <div class="input-group">
            <label>访问口令</label>
            <input
              v-model="cfg.cloudflarePassword"
              type="password"
              placeholder="设置 > Cloudflare 环境变量 CLOUD_PASSWORD"
              class="input"
            />
          </div>
          <div class="section-actions">
            <button class="action-row sync-row" :disabled="syncing" @click="backupKV">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">{{ syncing === 'kv-up' ? '备份中...' : '上传到 KV' }}</span>
                <span class="action-desc">将当前数据备份到 Cloudflare KV</span>
              </div>
            </button>
            <button class="action-row sync-row" :disabled="syncing" @click="restoreKV">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">{{ syncing === 'kv-down' ? '恢复中...' : '从 KV 恢复' }}</span>
                <span class="action-desc">从 Cloudflare KV 拉取数据恢复到本地</span>
              </div>
            </button>
          </div>
        </section>

        <!-- WebDAV 备份 -->
        <section class="section">
          <h3 class="section-title">WebDAV 备份</h3>
          <div class="input-group">
            <label>WebDAV 地址</label>
            <input
              v-model="cfg.webdavUrl"
              type="url"
              placeholder="https://example.com/remote.php/dav/files/user/"
              class="input"
            />
          </div>
          <div class="input-group">
            <label>用户名</label>
            <input
              v-model="cfg.webdavUsername"
              type="text"
              placeholder="用户名"
              class="input"
            />
          </div>
          <div class="input-group">
            <label>密码</label>
            <input
              v-model="cfg.webdavPassword"
              type="password"
              placeholder="密码"
              class="input"
            />
          </div>
          <div class="section-actions">
            <button class="action-row sync-row" :disabled="syncing" @click="backupWebDAV">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">{{ syncing === 'webdav-up' ? '备份中...' : '上传到 WebDAV' }}</span>
                <span class="action-desc">将当前数据备份到 WebDAV 服务器</span>
              </div>
            </button>
            <button class="action-row sync-row" :disabled="syncing" @click="restoreWebDAV">
              <div class="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">{{ syncing === 'webdav-down' ? '恢复中...' : '从 WebDAV 恢复' }}</span>
                <span class="action-desc">从 WebDAV 服务器拉取数据恢复到本地</span>
              </div>
            </button>
          </div>
        </section>

        <!-- 关于 -->
        <section class="section">
          <h3 class="section-title">关于</h3>
          <p class="about-text">
            TOTP 验证器 v1.0<br/>
            纯前端运行，密钥仅保存在本地存储中。<br/>
            支持 WebDAV 和 Cloudflare KV 备份。
          </p>
        </section>
      </div>

      <!-- 提示消息 -->
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadAccounts, saveAccounts } from '../utils/db'
import { serializeBackup } from '../utils/totp'
import {
  loadBackupConfig,
  saveBackupConfig,
  backupToWebDAV,
  restoreFromWebDAV,
  backupToKV,
  restoreFromKV
} from '../utils/backup'
import type { TOTPAccount } from '../utils/totp'

const emit = defineEmits<{
  close: []
  restored: []
}>()

const cfg = ref(loadBackupConfig())
const syncing = ref<string | false>(false)
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)

let toastTimer: number

function showToast(message: string, type: 'success' | 'error' = 'success') {
  clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = window.setTimeout(() => { toast.value = null }, 3000)
}

onMounted(() => {
  // 自动保存配置
})

function saveCfg() {
  saveBackupConfig(cfg.value)
}

// 导出
function exportData() {
  const accounts = loadAccounts()
  const data = serializeBackup(accounts)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `totp-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('导出成功')
}

// 导入
function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.accounts || !Array.isArray(data.accounts)) {
        showToast('文件格式无效', 'error')
        return
      }
      saveAccounts(data.accounts as TOTPAccount[])
      showToast(`导入成功 (${data.accounts.length} 个账户)`)
      emit('restored')
    } catch {
      showToast('导入失败，文件格式错误', 'error')
    }
  }
  input.click()
}

// KV 备份
async function backupKV() {
  saveCfg()
  syncing.value = 'kv-up'
  try {
    const msg = await backupToKV(cfg.value)
    showToast(msg)
  } catch (e: any) {
    showToast(e.message || 'KV 备份失败', 'error')
  }
  syncing.value = false
}

async function restoreKV() {
  saveCfg()
  syncing.value = 'kv-down'
  try {
    const { message } = await restoreFromKV(cfg.value)
    showToast(message)
    emit('restored')
  } catch (e: any) {
    showToast(e.message || 'KV 恢复失败', 'error')
  }
  syncing.value = false
}

// WebDAV 备份
async function backupWebDAV() {
  saveCfg()
  syncing.value = 'webdav-up'
  try {
    const msg = await backupToWebDAV(cfg.value)
    showToast(msg)
  } catch (e: any) {
    showToast(e.message || 'WebDAV 备份失败', 'error')
  }
  syncing.value = false
}

async function restoreWebDAV() {
  saveCfg()
  syncing.value = 'webdav-down'
  try {
    const { message } = await restoreFromWebDAV(cfg.value)
    showToast(message)
    emit('restored')
  } catch (e: any) {
    showToast(e.message || 'WebDAV 恢复失败', 'error')
  }
  syncing.value = false
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  animation: scaleIn 0.2s ease;
  box-shadow: var(--shadow);
  position: relative;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  z-index: 2;
}

.modal-header h2 {
  font-size: 17px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-muted);
  transition: all 0.15s;
}
.close-btn:hover {
  background: var(--bg-accent);
  color: var(--text-primary);
}

.modal-body {
  padding: 8px 20px 20px;
}

/* 分区 */
.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.section-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
  border-radius: 0;
}
.action-row:hover:not(:disabled) {
  background: var(--bg-accent);
}
.action-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-accent);
  border-radius: 8px;
  color: var(--accent);
  flex-shrink: 0;
}

.action-info {
  flex: 1;
  min-width: 0;
}

.action-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.action-desc {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

.sync-row .action-icon {
  color: var(--text-secondary);
}
.sync-row:hover:not(:disabled) .action-icon {
  color: var(--accent);
}

/* 输入 */
.input-group {
  margin-bottom: 10px;
}

.input-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.input {
  width: 100%;
  padding: 9px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: var(--accent);
}

/* 关于 */
.about-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* Toast */
.toast {
  position: absolute;
  bottom: 16px;
  left: 20px;
  right: 20px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  animation: slideUp 0.2s ease;
  z-index: 3;
}
.toast.success {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent);
}
.toast.error {
  background: var(--danger-dim);
  color: var(--danger);
  border: 1px solid var(--danger);
}
</style>