<template>
  <div class="scanner-overlay">
    <div class="scanner-container">
      <div class="scanner-header">
        <h3>扫描二维码</h3>
        <button class="close-btn" @click="close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="scanner-body">
        <!-- 摄像头画面 -->
        <div v-if="scanning" class="video-wrap">
          <video ref="videoRef" class="video" autoplay playsinline></video>
          <canvas ref="canvasRef" class="scan-canvas" style="display:none"></canvas>
          <!-- 扫描框 -->
          <div class="scan-frame">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
            <div class="scan-line"></div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-if="error" class="error-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p class="error-text">{{ error }}</p>
          <button class="retry-btn" @click="startScan">重新尝试</button>
        </div>

        <!-- 提示 -->
        <p v-if="scanning && !error" class="hint">将二维码对准框内，自动识别</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import jsQR from 'jsqr'

const emit = defineEmits<{
  close: []
  scanned: [uri: string]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scanning = ref(false)
const error = ref('')

let stream: MediaStream | null = null
let animFrame: number = 0

onMounted(() => {
  startScan()
})

onUnmounted(() => {
  stopScan()
})

function close() {
  stopScan()
  emit('close')
}

async function startScan() {
  error.value = ''
  scanning.value = true

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    })

    // 等一帧让 video 元素渲染
    await new Promise(r => setTimeout(r, 50))

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play()
      tick()
    }
  } catch (e: any) {
    scanning.value = false
    if (e.name === 'NotAllowedError') {
      error.value = '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
    } else if (e.name === 'NotFoundError') {
      error.value = '未检测到摄像头设备'
    } else {
      error.value = '无法启动摄像头: ' + (e.message || '未知错误')
    }
  }
}

function stopScan() {
  scanning.value = false
  if (animFrame) {
    cancelAnimationFrame(animFrame)
    animFrame = 0
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
}

function tick() {
  if (!scanning.value || !videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value

  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    animFrame = requestAnimationFrame(tick)
    return
  }

  const w = video.videoWidth
  const h = video.videoHeight
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' })

  if (code && code.data) {
    const data = code.data.trim()
    if (data.startsWith('otpauth://')) {
      stopScan()
      emit('scanned', data)
      return
    }
  }

  animFrame = requestAnimationFrame(tick)
}
</script>

<style scoped>
.scanner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.2s ease;
}

.scanner-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 360px;
  overflow: hidden;
  animation: scaleIn 0.2s ease;
}

.scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.scanner-header h3 {
  font-size: 15px;
  font-weight: 600;
}

.close-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.15s;
}
.close-btn:hover {
  background: var(--bg-accent);
  color: var(--text-primary);
}

.scanner-body {
  padding: 16px;
}

/* 视频区域 */
.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #000;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 扫描框 */
.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60%;
  height: 60%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: var(--accent);
  border-style: solid;
  border-width: 0;
}
.corner.top-left {
  top: 0; left: 0;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 4px;
}
.corner.top-right {
  top: 0; right: 0;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 4px;
}
.corner.bottom-left {
  bottom: 0; left: 0;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 4px;
}
.corner.bottom-right {
  bottom: 0; right: 0;
  border-bottom-width: 2px;
  border-right-width: 2px;
  border-bottom-right-radius: 4px;
}

/* 扫描线 */
.scan-line {
  position: absolute;
  top: 0;
  left: 8%;
  width: 84%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: scanMove 2s ease-in-out infinite;
}

@keyframes scanMove {
  0% { top: 10%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 90%; opacity: 0; }
}

/* 错误状态 */
.error-state {
  text-align: center;
  padding: 24px 16px;
}
.error-text {
  font-size: 13px;
  color: var(--danger);
  margin-top: 12px;
  line-height: 1.5;
}
.retry-btn {
  margin-top: 14px;
  padding: 8px 20px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.15s;
}
.retry-btn:hover {
  opacity: 0.9;
}

.hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 10px;
}
</style>