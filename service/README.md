# 反馈服务

反馈区的后端：接收玩家提交、保存记录与截图、对外提供记录列表与进度、给维护者留一个改状态的入口。

## 为什么要有一个服务

站点是纯静态的，浏览器存不下玩家提交的数据。上一版走 GitHub 的 Issue 表单，代价是玩家必须有 GitHub 账号、
还要填一整套环境表——对普通 MC 玩家门槛太高。所以改成：**页面自己收，本服务自己存**。
玩家只填标题 / 版本 / 内容（可选截图），不注册、不跳转。

设计取向：

- **零依赖**：只用 Node 内置模块，没有 npm 包、没有数据库、没有第三方表单服务。
- **一个目录就是全部数据**：`service/data/records.json` 加 `service/data/uploads/`，
  备份就是复制这个目录，迁移就是把它搬过去。
- **无用户体系**：玩家不注册，因此服务端也不存密码、不发邮件，只认「提交」和「维护者密钥」两种身份。
- **联系方式不公开**：玩家填的联系方式只写进存储，公开接口永远不返回（见 `CONTRACT.md`）。

## 本地跑起来

```bash
npm run service            # http://127.0.0.1:8787，数据写到 service/data/
npm run service:test       # 46 项自测：真起进程、真走 HTTP，用临时数据目录
```

自测不需要网络，也不会碰 `service/data/`。第一次启动时如果数据目录是空的，
会自动导入 `public/records.json`（历史反馈 + 维护者导出的静态副本），所以在正式环境里
历史记录不会凭空消失。

## 接口

完整契约见 [`CONTRACT.md`](CONTRACT.md)：`GET /health`、`GET /records`、`GET /media/<文件>`、
`POST /submit`、`POST /status`。字段与上限的唯一来源是 [`store.mjs`](store.mjs)，
站点侧对应 `src/data/feedback.ts`，两边由 `npm run check:feedback` 在构建时比对。

## 环境变量

| 名称 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 监听端口 |
| `DATA_DIR` | `service/data` | 记录与图片目录，**务必持久化并对接备份** |
| `SEED_FILE` | `public/records.json` | 首次启动、库为空时导入的种子；设成空串则跳过 |
| `ADMIN_KEY` | 空 | 设置后才允许 `POST /status` 改状态。请用长随机串 |
| `ALLOWED_ORIGINS` | 站点域名 + 本地端口 | 允许的浏览器来源，逗号分隔 |
| `RATE_LIMIT_PER_HOUR` | `5` | 单 IP 每小时提交上限 |
| `DRY_RUN` | — | 设 `1` 则只校验并回显，不写盘（演练用） |

## 部署

站点是 `https://`，所以服务也必须走 `https://`（否则浏览器会拦混合内容），
并且把服务地址填进仓库变量 `FEEDBACK_API`，再重新部署站点（见最后一节）。

### 方式一：国内服务器 / 任意 VPS（国内访问最稳）

```bash
git clone https://github.com/Paltrow-Studio/ShotaPartner-Docs.git
cd ShotaPartner-Docs
ADMIN_KEY='换成长随机串' PORT=8787 DATA_DIR=/var/lib/shota-feedback node service/server.mjs
```

用 systemd 常驻：

```ini
# /etc/systemd/system/shota-feedback.service
[Unit]
Description=ShotaPartner feedback service
After=network.target

[Service]
WorkingDirectory=/opt/ShotaPartner-Docs
Environment=PORT=8787
Environment=DATA_DIR=/var/lib/shota-feedback
Environment=ADMIN_KEY=换成长随机串
Environment=ALLOWED_ORIGINS=https://paltrow-studio.github.io
ExecStart=/usr/bin/node service/server.mjs
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

nginx 反代（HTTPS 用你自己的证书或 certbot）：

```nginx
server {
  listen 443 ssl;
  server_name feedback.example.com;
  client_max_body_size 12m;      # 图片以 base64 承载，留出余量
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header X-Forwarded-For $remote_addr;   # 限流按 IP 统计
  }
}
```

### 方式二：Docker

```bash
docker build -t shota-feedback service/
docker run -d --name shota-feedback -p 8787:8787 \
  -e ADMIN_KEY='换成长随机串' \
  -e ALLOWED_ORIGINS='https://paltrow-studio.github.io' \
  -v /srv/shota-feedback:/data shota-feedback
```

镜像里以非 root 用户运行，数据目录挂到 `/data`（容器删了记录还在）。

### 方式三：Cloudflare Worker + KV（不需要服务器）

`worker.js` 是同一套契约的 Worker 实现，数据放 KV：

```bash
npx wrangler kv namespace create RECORDS
# 按输出把 binding 写进 wrangler.toml：
#   [[kv_namespaces]]
#   binding = "RECORDS"
#   id = "<上一步的 id>"
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

注意：`*.workers.dev` 在国内多数网络下无法直连，用这种方式请绑定自定义域名。
KV 的计数与序号分配是最终一致的，`/status` 与并发提交在极端情况下可能互相影响，
普通反馈量级下可以接受；要绝对一致就用方式一或二。

### 方式四：云函数（腾讯云 / 阿里云）

`server.mjs` 需要一个可写的持久目录。函数计算里挂载 NAS / CFS 到 `DATA_DIR` 即可，
其余按方式一的环境变量配置；HTTP 触发器的路径映射到 `/submit`、`/records`。

## 部署之后

1. 把服务地址填进站点：仓库 **Settings → Secrets and variables → Actions → Variables**，
   新建变量 `FEEDBACK_API`，值是服务地址（例如 `https://feedback.example.com`，不带结尾斜杠）。
2. 重新部署站点（推一次 `main`，或手动触发 workflow）。构建时该地址被注入页面，
   反馈页会自动切到实时数据与在线提交。
3. 验证：

```bash
curl https://feedback.example.com/health
curl 'https://feedback.example.com/records?limit=5'
```

## 维护

```bash
export FEEDBACK_URL=https://feedback.example.com
export ADMIN_KEY=换成长随机串

node service/admin.mjs list                        # 全部记录（带走联系方式需 ADMIN_KEY）
node service/admin.mjs list --status pending       # 只看待处理
node service/admin.mjs show F-0031                 # 单条详情（含联系方式）
node service/admin.mjs status F-0031 fixed         # 改状态：进度区立即更新

# 导出站点用的静态副本（服务不可用时页面会显示它）
node service/admin.mjs export --out public/records.json
```

状态取值：`pending`（待处理）、`investigating`（排查中）、`fixed`（已修复）、`closed`（已关闭）。
导出静态副本后提交它，站点在只读模式下也能看到最新进度。

### 备份

```bash
tar czf shota-feedback-$(date +%F).tar.gz -C /var/lib shota-feedback
```

`records.json` 里含玩家的联系方式，备份文件请按个人信息对待：不要放进公开仓库，
`.gitignore` 已经把 `service/data/` 排除在外。

### 迁移历史 issue

历史反馈已经导入成 `public/records.json`（23 条，编号 `F-0008`~`F-0030`）。
需要重新拉取时（只在补档时用，构建与部署都不依赖 GitHub）：

```bash
npm run seed:legacy        # 有 GH_TOKEN 走 REST，否则用本机 gh CLI
```