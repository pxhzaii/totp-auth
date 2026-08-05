// 纯前端 QR 码生成 (服务端为空时，客户端直接渲染 QR 码)
// 使用 QRious 的二维码生成逻辑，简化版

interface QRCodeOptions {
  value: string
  size?: number
  level?: 'L' | 'M' | 'Q' | 'H'
}

export function generateQRCodeDataURL(options: QRCodeOptions): string {
  const { value, size = 200, level = 'M' } = options
  // 使用 Google Chart API 生成 QR 码（最可靠的方式）
  const encoded = encodeURIComponent(value)
  const ecLevel = level
  return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&chld=${ecLevel}|0`
}

// 如果希望离线可用，可以用纯 JS 二维码库，但会增加包体积
// 这里采用 Google Chart API 在线生成，部署到 CF 后也能正常访问