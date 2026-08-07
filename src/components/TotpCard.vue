<template>
  <div class="card" :class="{ copying: copied }" @click="copyCode">
    <!-- 左侧：账户信息 -->
    <div class="card-left">
      <div class="issuer">{{ account.issuer || '未命名' }}</div>
      <div class="account-name">{{ account.account }}</div>
    </div>

    <!-- 中间：验证码大字 -->
    <div class="code-area">
      <span class="code-text">{{ displayCode }}</span>
    </div>

    <!-- 右侧：环形倒计时 + 操作 -->
    <div class="card-right">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 36 36">
          <circle class="ring-bg" cx="18" cy="18" r="15.5" />
          <circle
            class="ring-progress"
            cx="18" cy="18" r="15.5"
            :style="{ strokeDashoffset: dashOffset }"
            :class="{ urgent: remaining <= 5, warning: remaining > 5 && remaining <= 10 }"
          />
        </svg>
        <span class="ring-text">{{ remaining }}</span>
      </div>
      <div class="card-actions" @click.stop>
        <button class="action-btn" @click="copyCode" title="复制">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="action-btn" @click="confirmDelete" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
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

const circumference = 2 * Math.PI * 15.5

const dashOffset = computed(() => {
  return circumference * (1 - progress.value)
})

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
    // 降级
  }
}

function confirmDelete() {
  emit('delete', props.account.id)
}
</script>

<style scoped>
.card {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 12px 16px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
  animation: fadeIn 0.3s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
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
  box-shadow: 0 0 24px var(--accent-dim);
}

/* 左侧信息 */
.card-left {
  flex: 1;
  min-width: 0;
  margin-right: 12px;
}

.issuer {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
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
  line-height: 1.4;
}

/* 中间验证码 */
.code-area {
  flex-shrink: 0;
  margin-right: 14px;
}

.code-text {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--text-primary);
  white-space: nowrap;
}

/* 右侧 */
.card-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 小环形倒计时 */
.ring-wrap {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--bg-accent);
  stroke-width: 3;
}

.ring-progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 97.39;
  transition: stroke-dashoffset 1s linear, stroke 0.3s;
}

.ring-progress.warning {
  stroke: var(--warning);
}

.ring-progress.urgent {
  stroke: var(--danger);
}

.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 操作按钮 */
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 26px;
  height: 26px;
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
</style>