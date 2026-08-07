

# TOTP Authenticator

部署在 Cloudflare Pages 上的两步验证器，支持 Cloudflare KV 云端备份。
- **演示站点** https://totp-auth-1d9.pages.dev/
- **访问密码** 密码11
- **同步密码** 同步密码22
- **注意** 因为可能会有其他人测试，所以可能会有同步/恢复丢失的情况

## 功能

- **TOTP 生成** — 纯浏览器端计算，RFC 6238 标准，6 位 / 30 秒
- **条形进度条** — 倒计时可视化，5 秒内变红警告，10 秒内变黄
- **点击复制** — 点击卡片自动复制验证码到剪贴板，失败时自动降级
- **添加账户** — 手动输入密钥 / 粘贴 `otpauth://` URI / 摄像头扫描二维码
- **智能粘贴** — 在密钥框粘贴 `otpauth://` URI 时自动切换到 URI 解析模式
- **本地存储** — 密钥存 localStorage，纯 JSON 明文存储（无 XOR 加密，避免截断 bug）
- **访问口令保护** — 设置 `ACCESS_PASSWORD` 后，打开页面需输入口令，15 分钟内免输入，关闭标签页重新索要
- **Cloudflare KV 备份** — 通过 Pages Functions API 备份，`CLOUD_PASSWORD` 口令保护，默认拒绝未授权访问
- **删除确认** — 删除账户前弹出确认，防止误触
- **数据校验** — 导入/恢复时逐字段校验，跳过无效条目，补全默认值
- **移动端适配** — 操作按钮在触屏设备始终可见，暗色主题

## 部署

### 1. Fork 或克隆本仓库

### 2. 创建 KV 命名空间

Cloudflare Dashboard → Workers & Pages → KV → 创建命名空间`TOTP_KV`，记下命名空间 ID

### 3. 修改 wrangler.toml

将 `id` 替换为你的 KV 命名空间 ID：

```toml
[[kv_namespaces]]
binding = "TOTP_KV"
id = "你的KV命名空间ID"
```

### 4. 创建 Pages 项目

Dashboard → Workers & Pages → 创建 → Pages → 连接 Git 仓库
- **注意**是最下方的小字 `想要部署 Pages？开始使用`
- **注意**是最下方的小字 `想要部署 Pages？开始使用`
- **注意**是最下方的小字 `想要部署 Pages？开始使用`
- **注意**是最下方的小字 `想要部署 Pages？开始使用`
- **注意**是最下方的小字 `想要部署 Pages？开始使用`

| 设置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

### 5. 绑定 KV 命名空间(现在好像会自动绑定)

项目 Settings → Functions → KV namespace bindings

| 变量名 | KV 命名空间 |
|---|---|
| `TOTP_KV` | 第 2 步创建的命名空间ID |

部署后需重新部署一次，使 KV 绑定生效

### 6. 设置环境变量

项目 Settings → Environment variables（Production 和 Preview 都需设置）

| 变量名 | 说明 |
|---|---|
| `CLOUD_PASSWORD` | 备份同步口令，**必须设置**，否则所有备份请求将被拒绝 |
| `ACCESS_PASSWORD` | 页面访问口令（可选），设置后打开页面需输入口令才能访问，15 分钟有效 |



## 本地开发

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`

## 备份说明

### Cloudflare KV

在设置面板中填入访问口令（与 `CLOUD_PASSWORD` 环境变量一致），即可一键上传/恢复。

恢复操作会覆盖本地所有数据，执行前会弹出确认。

### 导入/导出

- **导出** — 将所有账户导出为 JSON 文件
- **导入** — 从 JSON 文件恢复账户，会逐条校验格式，跳过无效条目

## 安全说明

- TOTP 密钥仅保存在浏览器 localStorage 中
- KV 备份通过 Cloudflare Pages Functions 代理，口令验证后才能操作
- 未设置 `CLOUD_PASSWORD` 环境变量时，所有备份请求默认拒绝
- 密码比较使用恒定时间算法，防止时序攻击
- CORS 限制为部署域名同源，防止第三方网站调用
- 备份 API 对 PUT 请求校验 JSON 合法性和结构完整性
- 全站 HTTPS，Cloudflare 自动提供 SSL

## 技术栈

- Vue 3 + TypeScript + Vite
- Cloudflare Pages + Functions
- Cloudflare KV
- Web Crypto API（HMAC-SHA1）
- jsQR（二维码扫描）

## License

MIT

> AI生成
