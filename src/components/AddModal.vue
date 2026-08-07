<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>添加账户</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- 二维码扫描（手动输入） -->
      <div class="tab-bar">
        <button
          class="tab"
          :class="{ active: tab === 'manual' }"
          @click="tab = 'manual'"
        >手动输入</button>
        <button
          class="tab"
          :class="{ active: tab === 'scan' }"
          @click="tab = 'scan'"
        >扫描二维码</button>
      </div>

      <!-- 手动输入 -->
      <div v-if="tab === 'manual'" class="tab-content">
        <div class="input-group">
          <label>名称 (Issuer)</label>
          <input
            v-model="form.issuer"
            type="text"
            placeholder="例如: GitHub, Google..."
            class="input"
            @input="parseField"
          />
        </div>
        <div class="input-group">
          <label>账户 (Account)</label>
          <input
            v-model="form.account"
            type="text"
            placeholder="例如: user@example.com"
            class="input"
            @input="parseField"
          />
        </div>
        <div class="input-group">
          <label>密钥 (Secret Key)</label>
          <div class="secret-input-wrap">
            <input
              v-model="form.secret"
              type="text"
              placeholder="Base32 密钥 (如 JBSWY3DPEHPK3PXP)"
              class="input input-mono"
              @input="parseField"
            />
            <button class="paste-btn" @click="pasteSecret" title="粘贴">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="input-group">
          <label>密钥类型</label>
          <div class="radio-group">
            <label class="radio">
              <input type="radio" v-model="form.keyType" value="time-based" />
              <span>基于时间 (TOTP)</span>
            </label>
            <label class="radio">
              <input type="radio" v-model="form.keyType" value="counter-based" disabled />
              <span style="opacity:0.4">基于计数 (HOTP)</span>
            </label>
          </div>
        </div>
        <div class="input-group">
          <label>算法</label>
          <select v-model="form.algorithm" class="input">
            <option value="SHA1">SHA1</option>
            <option value="SHA256" disabled>SHA256</option>
            <option value="SHA512" disabled>SHA512</option>
          </select>
        </div>
        <div class="input-row">
          <div class="input-group flex-1">
            <label>位数</label>
            <select v-model="form.digits" class="input">
              <option :value="6">6 位</option>
              <option :value="8" disabled>8 位</option>
            </select>
          </div>
          <div class="input-group flex-1">
            <label>周期</label>
            <select v-model="form.period" class="input">
              <option :value="30">30 秒</option>
              <option :value="60" disabled>60 秒</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 扫描二维码 -->
      <div v-if="tab === 'scan'" class="tab-content">
        <div class="scan-area">
          <!-- 摄像头扫描按钮 -->
          <button class="scan-camera-btn" @click="showQrScanner = true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>打开摄像头扫描</span>
          </button>

          <div class="scan-divider"><span>或手动粘贴 URI</span></div>

          <div class="input-group">
            <label>otpauth URI</label>
            <input
              v-model="uriInput"
              type="text"
              placeholder="otpauth://totp/..."
              class="input input-mono"
              @input="parseURI"
            />
          </div>
          <div v-if="uriError" class="uri-error">{{ uriError }}</div>
        </div>
      </div>

      <!-- 摄像头扫描弹窗 -->
      <QrScanner v-if="showQrScanner" @close="showQrScanner = false" @scanned="onQrScanned" />

      <!-- 确认按钮 -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!canSave"
          @click="saveAccount"
        >
          添加账户
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { addAccount } from '../utils/db'
import { generateRandomSecret, generateOTPAuthURL, generateTOTP } from '../utils/totp'
import type { TOTPAccount } from '../utils/totp'
import QrScanner from './QrScanner.vue'

const emit = defineEmits<{
  close: []
  added: []
}>()

const tab = ref<'manual' | 'scan'>('manual')
const uriInput = ref('')
const uriError = ref('')
const showQrScanner = ref(false)

const form = ref({
  issuer: '',
  account: '',
  secret: '',
  keyType: 'time-based',
  algorithm: 'SHA1',
  digits: 6,
  period: 30
})

const canSave = computed(() => {
  return form.value.issuer.trim() && form.value.account.trim() && form.value.secret.trim()
})

function parseField() {
  // 自动格式化密钥：去空格、大写
  form.value.secret = form.value.secret.replace(/[^A-Za-z2-7]/g, '').toUpperCase()
}

function parseURI() {
  uriError.value = ''
  const uri = uriInput.value.trim()
  if (!uri) return

  // otpauth 协议不是标准 URL，不能用 new URL() 解析
  // 格式: otpauth://totp/Issuer:Account?secret=xxx&...
  const match = uri.match(/^otpauth:\/\/totp\/(.+)\?(.+)/)
  if (!match) {
    uriError.value = '无效的 otpauth URI'
    return
  }

  const label = decodeURIComponent(match[1])
  const colonIdx = label.indexOf(':')
  if (colonIdx > 0) {
    form.value.issuer = label.slice(0, colonIdx)
    form.value.account = label.slice(colonIdx + 1)
  } else {
    form.value.account = label
  }

  // 手动解析 query 参数
  const params = new URLSearchParams(match[2])
  form.value.secret = params.get('secret') || ''
  form.value.algorithm = params.get('algorithm') || 'SHA1'
  form.value.digits = parseInt(params.get('digits') || '6')
  form.value.period = parseInt(params.get('period') || '30')
  form.value.keyType = 'time-based'

  parseField()
}

function onQrScanned(uri: string) {
  showQrScanner.value = false
  uriInput.value = uri
  parseURI()
}

async function pasteSecret() {
  try {
    const text = await navigator.clipboard.readText()
    form.value.secret = text
    parseField()
  } catch {
    // 忽略
  }
}

async function saveAccount() {
  if (!canSave.value) return

  // 验证密钥有效性
  try {
    await generateTOTP(form.value.secret, form.value.period, form.value.digits)
  } catch {
    uriError.value = '密钥无效，请检查后重试'
    return
  }

  const account: TOTPAccount = {
    id: crypto.randomUUID(),
    issuer: form.value.issuer.trim(),
    account: form.value.account.trim(),
    secret: form.value.secret,
    period: form.value.period,
    digits: form.value.digits,
    createdAt: Date.now(),
    order: Date.now()
  }

  addAccount(account)
  emit('added')
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
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  animation: scaleIn 0.2s ease;
  box-shadow: var(--shadow);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
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

/* Tab 切换 */
.tab-bar {
  display: flex;
  margin: 0 20px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.tab {
  flex: 1;
  padding: 8px;
  text-align: center;
  font-size: 13px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.2s;
}
.tab.active {
  background: var(--bg-accent);
  color: var(--text-primary);
  font-weight: 500;
}

.tab-content {
  padding: 16px 20px;
}

.input-group {
  margin-bottom: 14px;
}

.input-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: var(--accent);
}
.input-mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.input-row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.secret-input-wrap {
  position: relative;
}

.secret-input-wrap .input {
  padding-right: 40px;
}

.paste-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.15s;
}
.paste-btn:hover {
  background: var(--bg-accent);
  color: var(--accent);
}

/* 单选按钮 */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.radio input[type="radio"] {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

/* 扫描区域 */
.scan-area {
  text-align: center;
}

.scan-camera-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 28px 20px;
  background: var(--bg-primary);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius);
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  margin-bottom: 16px;
}
.scan-camera-btn:hover {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.scan-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: 12px;
}
.scan-divider::before,
.scan-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.uri-error {
  color: var(--danger);
  font-size: 12px;
  margin-top: -10px;
  margin-bottom: 14px;
}

/* 底部按钮 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 18px;
}

.btn {
  padding: 9px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 600;
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-primary:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-accent);
  color: var(--text-secondary);
}
.btn-secondary:hover {
  color: var(--text-primary);
}
</style>