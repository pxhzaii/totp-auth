<template>
  <!-- 访问口令锁屏 -->
  <div v-if="!accessAuthed" class="lock-screen">
    <div class="lock-card">
      <div class="lock-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2 class="lock-title">TOTP 验证器</h2>
      <p class="lock-desc">请输入访问口令以继续</p>
      <div class="lock-form">
        <input
          ref="lockInputRef"
          v-model="accessPassword"
          type="password"
          class="lock-input"
          placeholder="访问口令"
          @keydown.enter="submitAccess"
          :disabled="accessLoading"
        />
        <button class="lock-btn" :disabled="!accessPassword.trim() || accessLoading" @click="submitAccess">
          {{ accessLoading ? '验证中...' : '进入' }}
        </button>
      </div>
      <p v-if="accessError" class="lock-error">{{ accessError }}</p>
    </div>
  </div>

  <!-- 主内容 -->
  <div v-else class="app-container">
    <!-- 顶部栏 -->
    <header class="header">
      <div class="header-left">
        <h1 class="title">验证器</h1>
        <span class="subtitle">{{ accounts.length }} 个账户</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" @click="showSettings = true" title="设置">
          <span>设置</span>
        </button>
        <button class="add-btn" @click="showAddModal = true" title="添加账户">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>添加</span>
        </button>
      </div>
    </header>

    <!-- 账户列表 -->
    <div class="list-container" ref="listRef">
      <TransitionGroup name="slide" tag="div" class="card-list">
        <TotpCard
          v-for="account in accounts"
          :key="account.id"
          :account="account"
          :time="currentTime"
          @delete="handleDelete"
          @edit="handleEdit"
        />
      </TransitionGroup>

      <div v-if="accounts.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p class="empty-text">暂无账户</p>
        <p class="empty-hint">点击右下角"添加"按钮，<br/>扫描二维码或手动输入密钥</p>
      </div>
    </div>

    <!-- 添加弹窗 -->
    <AddModal v-if="showAddModal" @close="showAddModal = false" @added="onAccountAdded" />

    <!-- 设置面板 -->
    <SettingsPanel v-if="showSettings" @close="showSettings = false" @restored="onRestored" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import TotpCard from './components/TotpCard.vue'
import AddModal from './components/AddModal.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { loadAccounts, deleteAccount, updateAccount } from './utils/db'
import { isAccessAuthed, markAccessAuthed, verifyAccessPassword } from './utils/auth'
import type { TOTPAccount } from './utils/totp'

// --- 访问口令 ---
const accessAuthed = ref(isAccessAuthed())
const accessPassword = ref('')
const accessLoading = ref(false)
const accessError = ref('')
const lockInputRef = ref<HTMLInputElement | null>(null)

// 如果未认证，等 DOM 渲染后聚焦输入框
if (!accessAuthed.value) {
  nextTick(() => {
    lockInputRef.value?.focus()
  })
}

async function submitAccess() {
  if (!accessPassword.value.trim() || accessLoading.value) return
  accessLoading.value = true
  accessError.value = ''
  try {
    const valid = await verifyAccessPassword(accessPassword.value.trim())
    if (valid) {
      markAccessAuthed()
      accessAuthed.value = true
    } else {
      accessError.value = '口令错误，请重试'
      accessPassword.value = ''
    }
  } catch {
    accessError.value = '验证失败，请检查网络连接'
  }
  accessLoading.value = false
}

// --- 主应用逻辑 ---
const accounts = ref<TOTPAccount[]>([])
const currentTime = ref(Date.now())
const showAddModal = ref(false)
const showSettings = ref(false)
const listRef = ref<HTMLElement | null>(null)

let timer: number

function refresh() {
  accounts.value = loadAccounts()
  currentTime.value = Date.now()
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

function handleDelete(id: string) {
  deleteAccount(id)
  refresh()
}

function handleEdit(account: TOTPAccount) {
  updateAccount(account)
  refresh()
}

function onAccountAdded() {
  showAddModal.value = false
  refresh()
  // 滚动到底部
  setTimeout(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  }, 100)
}

function onRestored() {
  showSettings.value = false
  refresh()
}
</script>

<style scoped>
/* 锁屏界面 */
.lock-screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  animation: fadeIn 0.4s ease;
}

.lock-card {
  width: 100%;
  max-width: 340px;
  padding: 40px 28px;
  text-align: center;
}

.lock-icon {
  margin-bottom: 20px;
  opacity: 0.85;
}

.lock-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.lock-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 28px;
}

.lock-form {
  display: flex;
  gap: 8px;
}

.lock-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.lock-input:focus {
  border-color: var(--accent);
}
.lock-input::placeholder {
  color: var(--text-muted);
}
.lock-input:disabled {
  opacity: 0.5;
}

.lock-btn {
  padding: 10px 20px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.lock-btn:hover:not(:disabled) {
  opacity: 0.9;
}
.lock-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.lock-error {
  margin-top: 14px;
  font-size: 12px;
  color: var(--danger);
}

/* 主容器 */
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  position: relative;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.icon-btn:hover {
  background: var(--bg-accent);
  color: var(--text-primary);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.add-btn:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 100px;
  -webkit-overflow-scrolling: touch;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 480px;
  margin: 0 auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  animation: fadeIn 0.4s ease;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.6;
  opacity: 0.6;
}
</style>
