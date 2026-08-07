<template>
  <div class="card" :class="{ copying: copied, urgent: remaining <= 5 }" @click="copyCode">
    <div class="card-top">
      <div class="card-info">
        <div class="issuer">{{ account.issuer || '未命名' }}</div>
        <div class="account-name">{{ account.account }}</div>
      </div>
      <div class="code-area">
        <span class="code-text">{{ displayCode }}</span>
      </div>
      <div class="card-actions" @click.stop>
        <button class="action-btn" @click="copyCode" title="复制">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="action-btn delete-btn" @click="confirmDelete" title="删除">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{ width: (1 - progress) * 100 + '%' }"
        :class="{ warning: remaining > 5 && remaining <= 10, urgent: remaining <= 5 }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { generateTOTP } from '../utils/totp'
import type { TOTPAccount } from '../utils/totp'

const props = defineProps<{
  account: TOTPAccount
  time: number
}>()

const emit = defineEmits<{
  delete: [id: string]
  edit: [account: TOTPAccount]
}>()

const totpCode = ref('')
const remaining = ref(30)
const progress = ref(0)
const copied = ref(false)

const displayCode = computed(() => {
  const code = totpCode.value
  if (code.length === 6) {
    return code.slice(0, 3) + ' ' + code.slice(3)
  }
  if (code.length === 8) {
    return code.slice(0, 4) + ' ' + code.slice(4)
  }
  return code
})

async function updateCode() {
  try {
    const result = await generateTOTP(
      props.account.secret,
      props.account.period || 30,
      props.account.digits || 6
    )
    totpCode.value = result.code
    remaining.value = result.remaining
    progress.value = result.progress
  } catch {
    totpCode.value = '------'
    remaining.value = 0
    progress.value = 0
  }
}

watch(() => props.time, updateCode, { immediate: true })

async function copyCode() {
  try {
    await navigator.clipboard.writeText(totpCode.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1200)
  } catch {
    // ignore
  }
}

function confirmDelete() {
  emit('delete', props.account.id)
}
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
  animation: fadeIn 0.3s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}
.card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-light);
}
.card:active {
  transform: scale(0.99);
}
.card.copying {
  border-color: var(--accent);
  box-shadow: 0 0 20px var(--accent-dim);
}

.card-top {
  display: flex;
  align-items: center;
  padding: 14px 14px 12px;
  gap: 12px;
}

/* 左侧信息 */
.card-info {
  flex: 1;
  min-width: 0;
}

.issuer {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-name {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 验证码 */
.code-area {
  flex-shrink: 0;
}

.code-text {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Consolas', monospace;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--text-primary);
  white-space: nowrap;
}

.card.urgent .code-text {
  color: var(--danger);
}

/* 操作按钮 */
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}
.card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.15s;
}
.action-btn:hover {
  background: var(--bg-accent);
  color: var(--text-primary);
}
.delete-btn:hover {
  color: var(--danger);
  background: var(--danger-dim);
}

/* 条形进度条 */
.progress-bar {
  height: 3px;
  background: var(--bg-accent);
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 1s linear, background 0.3s;
  border-radius: 0 2px 2px 0;
}

.progress-fill.warning {
  background: var(--warning);
}

.progress-fill.urgent {
  background: var(--danger);
}
</style>