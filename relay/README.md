# 反馈中继

把站点的反馈草稿转成 GitHub issue 的最小后端。**只在需要国内直连提交时才部署；不部署时站点照常工作**，反馈区退回「复制 / 下载草稿」的离线路径。

## 为什么需要它

| 路线 | 能否在国内提交 issue | 原因 |
| --- | --- | --- |
| 直连 `github.com` | 否（网络层） | `issues/new` 需要 GitHub 会话，且国内经常打不开 |
| gh-proxy / ghfast / gh.llkk 等文件加速节点 | 否 | 只转发 raw / archive / release，HTML 页面一律 403 / 404（2026-09-30 实测） |
| **本中继** | **可以** | 由部署在境外的服务持有令牌调用 `api.github.com`，玩家只需能打开本中继的域名 |

中继承担两件事：校验并规整玩家提交的内容、用服务端令牌创建 issue。令牌永远不下发到浏览器。

## 两种部署方式

两份实现接口完全一致，选一个即可。

### 1. Node（推荐：香港 / 日本 VPS，或国内云函数容器）

要求 Node 18+（用到全局 `fetch`），**零依赖**。

```bash
# 在服务器上
GITHUB_TOKEN=github_pat_xxx \
GITHUB_REPO=Paltrow-Studio/ShotaPartner-Docs \
ALLOWED_ORIGINS=https://paltrow-studio.github.io \
PORT=8787 \
node relay/server.mjs
```

生产环境建议用 systemd 或容器托管，并在前面放一层 HTTPS 反向代理（Caddy / Nginx）。
自测：`DRY_RUN=1 node relay/server.mjs`，此时不调用 GitHub API，只回显将会创建的内容。

### 2. Cloudflare Worker

```bash
cd relay
npx wrangler deploy worker.js --name shota-feedback-relay --compatibility-date 2026-09-01
npx wrangler secret put GITHUB_TOKEN
```

其余变量在 wrangler 配置里以明文变量写入：`GITHUB_REPO`、`ALLOWED_ORIGINS`、`RATE_LIMIT_PER_HOUR`、`RELAY_SECRET`。

**可达性提示**：`*.workers.dev` 在国内常被 DNS 污染，不稳定；如果部署在 Cloudflare，建议绑定自有域名并实测。Worker 的模块级内存不跨边缘节点共享，限流是尽力而为——需要严格限流请改 Durable Object / KV，或开启 Turnstile。

## 令牌要求

- 类型：GitHub **fine-grained PAT**（细粒度）。
- 仓库访问：仅 `Paltrow-Studio/ShotaPartner-Docs`。
- 权限：`Issues: Read and write`，其余全部 `No access`。
- 该令牌只存在于中继的环境变量里，不写入仓库、不下发到页面。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 无 | 必填（`DRY_RUN=1` 时可不填） |
| `GITHUB_REPO` | `Paltrow-Studio/ShotaPartner-Docs` | 目标仓库 |
| `PORT` | `8787` | 仅 Node 版 |
| `ALLOWED_ORIGINS` | 站点域名 + 本地预览 | 逗号分隔；不在列表内的 `Origin` 会被 403 |
| `RATE_LIMIT_PER_HOUR` | `5` | 单 IP 每小时可成功创建的 issue 数 |
| `RELAY_SECRET` | 空 | 设置后要求请求头 `X-Relay-Key` 一致；对静态页没有遮蔽作用，仅用于挡扫描脚本 |
| `DRY_RUN` | 空 | `1` 时只校验并回显，不创建 issue |

## 接口

### `GET /health`

```json
{ "ok": true, "repo": "Paltrow-Studio/ShotaPartner-Docs", "dryRun": false, "time": "2026-09-30T14:00:00.000Z" }
```

页面用它判断中继是否可用（探针结果会显示在反馈区的「资源线路自动测试」列表里）。

### `POST /issue`

请求（`content-type: application/json`）：

```json
{
  "type": "bug",
  "module": "core",
  "summary": "伙伴在工作时不会拾取掉落物",
  "body": "### 环境\n- 模组版本：0.3.1\n…",
  "contact": "QQ 12345",
  "titlePrefix": "[Bug]",
  "moduleTag": "Core",
  "honeypot": ""
}
```

成功：`201` + `{ "ok": true, "issue": { "number": 12, "url": "https://github.com/…/issues/12" } }`

失败：`{ "ok": false, "error": "…", "detail": "…" }`，状态码含义：

| 状态码 | 含义 |
| --- | --- |
| `400` | 校验失败（类型 / 长度 / 蜜罐） |
| `403` | 来源不在允许列表，或 `X-Relay-Key` 不符 |
| `413` | 请求体超过 32 KB |
| `429` | 触发单 IP 限流 |
| `502` | 上游 `api.github.com` 报错（`detail` 为 GitHub 的原始信息） |

## 安全设计

- **标签由服务端决定**：客户端传来的标签一律忽略，只按 `type` + `module` 映射，避免伪造评论分类。
- **蜜罐字段**：`honeypot` 非空即拒绝；该字段在页面上不可见，正常用户不会填。
- **长度上限**：标题 120 字、正文 8000 字、请求体 32 KB。
- **限流在校验之后**：格式错误与蜜罐命中的请求不消耗配额，一次手误不会把同一网络下的正常提交一起挡掉。
- **来源白名单**：仅允许站点域名与本地预览地址。
- **可追溯**：正文尾部由服务端追加提交时间与联系方式，便于维护者核对。

## 接入页面

在 `src/data/site.ts` 填入中继地址（留空则完全不显示提交按钮，页面其余部分不受影响）：

```ts
export const FEEDBACK_RELAY_URL = 'https://relay.example.com'
```

也可以用构建期变量覆盖，便于本地联调：

```bash
VITE_RELAY_URL=http://127.0.0.1:8787 npm run build
```

## 上线前的自测

```bash
# 1. 干跑，确认校验与标签映射
DRY_RUN=1 node relay/server.mjs &
curl -s localhost:8787/health
curl -s -X POST localhost:8787/issue -H 'content-type: application/json' \
  -d '{"type":"bug","module":"core","summary":"标题示例","body":"### 环境\n- 模组版本：0.3.1\n"}'

# 2. 真实提交一次，确认令牌权限（会自动创建一条 issue，测试后手动关闭）
GITHUB_TOKEN=xxx node relay/server.mjs &
curl -s -X POST localhost:8787/issue -H 'content-type: application/json' \
  -d '{"type":"bug","module":"docs","summary":"中继自测，可关闭","body":"这是一条用于验证中继链路的测试 issue，请忽略。\n"}'
```

回滚：把 `FEEDBACK_RELAY_URL` 清空重新构建即可，页面回到纯静态的离线草稿模式。
