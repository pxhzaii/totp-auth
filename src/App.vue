<template>
  <div class="app-container">
    <!-- 顶部栏 -->
    <header class="header">
      <div class="header-left">
        <h1 class="title">验证器</h1>
        <span class="subtitle">{{ accounts.length }} 个账户</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" @click="showSettings = true" title="设置">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
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
import { ref, onMounted, onUnmounted } from 'vue'
import TotpCard from './components/TotpCard.vue'
import AddModal from './components/AddModal.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { loadAccounts, deleteAccount, updateAccount } from './utils/db'
import type { TOTPAccount } from './utils/totp'

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
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
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