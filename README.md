
# TOTP Authenticator

部署在 Cloudflare Pages 上的两步验证器，支持 Cloudflare KV 云端备份。

- **演示站点** https://totp-auth-1d9.pages.dev/


**账号**：`11`

**密码**：`22`
## 功能

- **TOTP 生成** — 纯浏览器端计算，RFC 6238 标准，6 位 / 30 秒
- **条形进度条** — 倒计时可视化，5 秒内变红警告，10 秒内变黄
- **点击复制** — 点击卡片自动复制验证码到剪贴板，失败时自动降级
- **添加账户** — 手动输入密钥 / 粘贴 `otpauth://` URI / 摄像头扫描二维码
- **智能粘贴** — 在密钥框粘贴 `otpauth://` URI 时自动切换到 URI 解析模式
- **本地存储** — 密钥存 localStorage，纯 JSON 明文存储（无 XOR 加密，避免截断 bug）
- **账号密码登录** — 设置 `AUTH_USERNAME` + `AUTH_PASSWORD` 后，打开页面需输入账号和密码，15 分钟内免输入，关闭标签页重新索要；5 次错误后锁定 15 分钟
- **Cloudflare KV 备份** — 通过 Pages Functions API 备份，复用登录账号密码验证，默认拒绝未授权访问，限流防暴力破解
- **删除确认** — 删除账户前弹出确认，防止误触
- **数据校验** — 导入/恢复时逐字段校验，跳过无效条目，补全默认值
- **移动端适配** — 操作按钮在触屏设备始终可见，暗色主题

## 部署

### 1. Fork 或克隆本仓库

### 2. 创建 KV 命名空间

Cloudflare Dashboard → Workers & Pages → KV → 创建命名空间，记下命名空间 ID

### 3. 创建 Pages 项目

Dashboard → Workers & Pages → 创建 → Pages → 连接 Git 仓库

| 设置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

### 4. 绑定 KV 命名空间

项目 Settings → Functions → KV namespace bindings

| 变量名 | KV 命名空间 |
|---|---|
| `TOTP_KV` | 第 2 步创建的命名空间 |

部署后需重新部署一次，使 KV 绑定生效

### 5. 设置环境变量

项目 Settings → Environment variables（Production 和 Preview 都需设置）

| 变量名 | 说明 |
|---|---|
| `AUTH_USERNAME` | 登录账号名，**必须设置**（与 AUTH_PASSWORD 配合使用） |
| `AUTH_PASSWORD` | 登录密码，**必须设置**，未设置时页面无访问保护且备份 API 拒绝所有请求 |

### 6. 本地开发：修改 wrangler.toml

将 `id` 替换为你的 KV 命名空间 ID（仅本地 `wrangler dev` 需要，线上部署通过 Dashboard 绑定即可）：

```toml
[[kv_namespaces]]
binding = "TOTP_KV"
id = "你的KV命名空间ID"
```

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`

## 备份说明

### Cloudflare KV

登录后，在设置面板中点击"上传到云端"或"从云端恢复"即可一键备份/恢复。凭据自动使用当前登录的账号密码，无需额外输入。

恢复操作会覆盖本地所有数据，执行前会弹出确认。

### 导入/导出

- **导出** — 将所有账户导出为 JSON 文件
- **导入** — 从 JSON 文件恢复账户，会逐条校验格式，跳过无效条目

## 安全说明

- TOTP 密钥仅保存在浏览器 localStorage 中
- KV 备份通过 Cloudflare Pages Functions 代理，登录凭据验证后才能操作
- 未设置 `AUTH_USERNAME` + `AUTH_PASSWORD` 环境变量时，页面无访问保护且备份 API 默认拒绝
- 密码比较使用恒定时间算法，防止时序攻击
- 登录和备份 API 均有 IP 限流保护，防暴力猜测
- 备份 API 对 PUT 请求校验 JSON 合法性、结构完整性和账户数量上限
- 全站 HTTPS，Cloudflare 自动提供 SSL

## 技术栈

- Vue 3 + TypeScript + Vite
- Cloudflare Pages + Functions
- Cloudflare KV
- Web Crypto API（HMAC-SHA1）
- jsQR（二维码扫描）

## License

MIT
