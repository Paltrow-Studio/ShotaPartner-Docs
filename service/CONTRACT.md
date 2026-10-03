# 反馈服务接口契约

页面（`feedback.html`）、Node 服务（`service/server.mjs`）、Cloudflare Worker（`service/worker.js`）
都按这份契约实现。字段名、状态取值、长度上限的唯一定义在 [`store.mjs`](store.mjs)，
本文件只描述 HTTP 层面的约定。

## 为什么有自己的服务

静态站点存不下玩家提交的数据，而 GitHub 的 issue 表单要求玩家有账号、还得填一堆字段。
所以：**页面自己收，服务自己存**，玩家只需要填标题 / 版本 / 内容，可选附截图。

## 记录（Record）

```json
{
  "id": "F-0031",
  "title": "伙伴不拾取掉落物",
  "version": "0.3.1（当前版本）",
  "content": "工作状态下不拾取掉落物，站着不动也会触发工作动画。",
  "images": ["/media/f-0031-1.webp"],
  "status": "pending",
  "createdAt": "2026-10-03T04:15:22.104Z",
  "updatedAt": "2026-10-03T04:15:22.104Z",
  "legacyUrl": "https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/30"
}
```

- `id`：`F-` + 四位序号，由服务端分配，永不改变。
- `status`：`pending` / `investigating` / `fixed` / `closed`（见 `store.mjs` 的 `STATUSES`）。
- `images`：相对路径 `/media/<文件名>`（相对服务基址）或 `http(s)` 绝对地址（历史记录的外链图）。
- `legacyUrl`：早期 issue 导入时保留的原链接，新提交没有这个字段。
- **`contact` 不出现在公开响应里**：只有带对了 `X-Admin-Key` 的 `GET /records` 才带它，
  供维护者用 `service/admin.mjs` 回访；页面永远拿不到它。

## 接口

### `GET /health`

```json
{ "ok": true, "service": "shota-feedback", "version": 1, "records": 23, "time": "2026-10-03T04:20:00.000Z" }
```

### `GET /records`

查询参数（都可选）：`status`（一个状态值，**取值非法时返回 400**，不静默忽略）、`limit`（1~200，默认 200）。
请求头带上正确的 `X-Admin-Key` 时，每条记录会额外包含 `contact`（维护者回访用）；
公开响应里**永远不含**这个字段。

```json
{ "ok": true, "generatedAt": "…", "total": 23, "records": [ /* 按 createdAt 倒序 */ ] }
```

### `GET /media/<文件名>`

返回图片字节，`Content-Type` 为提交时的类型，`Cache-Control: public, max-age=31536000, immutable`。
文件名只允许 `[A-Za-z0-9._-]`，不接受路径分隔符。找不到返回 404。

### `POST /submit`

请求体（JSON，`Content-Type: application/json`，UTF-8）：

```json
{
  "title": "伙伴不拾取掉落物",
  "version": "0.3.1（当前版本）",
  "content": "工作状态下不拾取掉落物……",
  "contact": "可选，便于回访",
  "images": [{ "name": "shot.webp", "type": "image/webp", "dataUrl": "data:image/webp;base64,…" }],
  "honeypot": ""
}
```

成功：`201`

```json
{ "ok": true, "record": { /* Record */ } }
```

失败：`400`

```json
{ "ok": false, "error": "标题至少 4 个字" }
```

其他状态码：`403` 来源不在允许列表 / 管理密钥不对、`413` 请求体过大、`429` 触发限流、
`500` 服务端未正确配置。**`error` 是可以直接显示给玩家看的中文句子。**

截图以 data URL 承载，因此一次提交就是一个 JSON 请求（Worker 里没有 multipart 解析器）。
上限见 `store.mjs` 的 `LIMITS`：单张 3 MB、合计 8 MB、最多 3 张；页面会先用 canvas
把图压到这个范围内再提交。

### `POST /status`（维护者）

需要请求头 `X-Admin-Key: <ADMIN_KEY>`：

```json
{ "id": "F-0031", "status": "fixed" }
```

成功：`{ "ok": true, "record": { /* Record */ } }`；编号不存在 → `404`。

### `POST /import`（维护者）

需要请求头 `X-Admin-Key: <ADMIN_KEY>`。用于补档与 Node ↔ Worker 迁移：
请求体里的记录已经成型（编号、时间、状态自备），因此**不重新编号、不改状态**。

```json
{ "records": [ { "id": "F-0101", "title": "…", "version": "0.2.0", "content": "…",
                 "images": ["https://example.com/a.png"], "status": "fixed",
                 "createdAt": "2026-01-02T03:04:05.000Z", "contact": "…" } ] }
```

- 成功：`{ "ok": true, "imported": 1, "skipped": 0, "problems": [] }`。
- **按编号幂等**：已存在的编号计入 `skipped`，不会覆盖，所以可以放心重跑。
- 逐条校验：坏记录进 `problems` 且不导入，好记录照常导入——补档时一条坏记录不该
  拖住其余 22 条；整批都不合法才返回 `400`。
- 一次最多 500 条（`IMPORT_MAX`），超过 → `400`。
- `contact` 会被保留（迁移不能让维护者丢掉回访线索），但依旧只出现在带管理密钥的响应里。
- `DRY_RUN=1` 时回显 `wouldImport` 且不写存储。

## 通用约定

- 所有响应都是 JSON（`/media` 除外），带 `Cache-Control: no-store`。
- CORS：`Access-Control-Allow-Origin` 只回允许列表里的来源，并带 `Vary: Origin`；
  允许 `GET, POST, OPTIONS` 与请求头 `content-type, x-admin-key`。
- 限流：按来源 IP 计，默认每 IP 每小时 5 条（`RATE_LIMIT_PER_HOUR`）。
  校验不通过的请求不消耗配额。
- 环境变量 / 绑定：
  | 名称 | Node | Worker | 说明 |
  | --- | --- | --- | --- |
  | 端口 | `PORT`（默认 8787） | — | |
  | 数据目录 | `DATA_DIR`（默认 `service/data`） | `RECORDS`（KV 绑定） | |
  | 管理密钥 | `ADMIN_KEY` | `ADMIN_KEY` | 改状态用；未设置则拒绝改状态 |
  | 允许来源 | `ALLOWED_ORIGINS` | `ALLOWED_ORIGINS` | 逗号分隔 |
  | 限流 | `RATE_LIMIT_PER_HOUR` | `RATE_LIMIT_PER_HOUR` | |
  | 演练 | `DRY_RUN=1` | `DRY_RUN=1` | 只校验并回显，不落盘 |