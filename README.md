---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '20a937b8-32d5-4613-a7b3-559e3d5f2c3d'
  PropagateID: '20a937b8-32d5-4613-a7b3-559e3d5f2c3d'
  ReservedCode1: '2670a96b-9ae2-4a4f-9eb0-498b30b015c9'
  ReservedCode2: '2670a96b-9ae2-4a4f-9eb0-498b30b015c9'
---

# TOTP Authenticator

部署在 Cloudflare Pages 上的两步验证器，支持 WebDAV 和 Cloudflare KV 云端备份。

## 功能

- **TOTP 生成** — 纯浏览器端计算，RFC 6238 标准，6 位 / 30 秒
- **环形进度条** — 倒计时可视化，5 秒内变红警告
- **点击复制** — 点击卡片自动复制验证码到剪贴板
- **添加账户** — 手动输入密钥 / 粘贴 `otpauth://` URI
- **本地加密存储** — 密钥经 XOR + 盐加密后存 localStorage
- **WebDAV 备份** — 一键上传/恢复到任意 WebDAV 服务器
- **Cloudflare KV 备份** — 通过 Worker API 备份，口令保护
- **暗色主题** — 移动端适配，零外部运行时依赖

## 部署

### 1. 创建 KV 命名空间

Cloudflare Dashboard → Workers & Pages → KV → 创建命名空间

### 2. 创建 Pages 项目

Dashboard → Workers & Pages → 创建 → 连接 Git 仓库 `pxhzaii/totp-auth`

| 设置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

### 3. 绑定 KV

项目 Settings → Functions → KV namespace bindings

| 变量名 | KV 命名空间 |
|---|---|
| `TOTP_KV` | 上一步创建的命名空间 |

### 4. 设置环境变量

项目 Settings → Environment variables

| 变量名 | 说明 |
|---|---|
| `CLOUD_PASSWORD` | 备份访问口令，留空则不启用口令保护 |

### 5. 修改 wrangler.toml

将 `id` 替换为你的 KV 命名空间 ID：

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

在设置面板中填入访问口令（与 `CLOUD_PASSWORD` 环境变量一致），即可一键上传/恢复。

### WebDAV

在设置面板中填入 WebDAV 地址、用户名、密码，支持坚果云、NextCloud 等 WebDAV 服务。

备份文件路径：`/totp-backup.json`

## 安全说明

- TOTP 密钥仅保存在浏览器 localStorage 中，使用随机主密钥 XOR 加密
- KV 备份通过 Cloudflare Worker 代理，口令验证后才能操作
- WebDAV 备份使用 HTTPS + Basic Auth 传输
- 全站 HTTPS，Cloudflare 自动提供 SSL

## 技术栈

- Vue 3 + TypeScript + Vite
- Cloudflare Pages + Functions
- Cloudflare KV
- Web Crypto API（HMAC-SHA1）

## License

MIT

> AI生成