#!/usr/bin/env node
/**
 * 反馈中继（Node 18+，零依赖）。
 *
 * 静态页面无法在国内直接把 issue 提交到 github.com：issue 表单需要 GitHub 会话，
 * 而国内的文件加速节点只转发 raw / archive / release，HTML 页面一律 403 / 404。
 * 这个中继放在能同时访问「玩家」与「api.github.com」的地方（香港 / 日本 VPS、
 * 国内云函数、Cloudflare Worker 均可），由它持有一个仅限本仓库、只有 Issues 写
 * 权限的令牌，代替玩家调用 GitHub API。
 *
 * 接口：
 *   GET  /health  → { ok, repo, dryRun, time }
 *   POST /issue   → { ok, issue: { number, url } }
 *                  失败时 { ok: false, error, detail? }
 *
 * 环境变量：
 *   GITHUB_TOKEN          必填（除 DRY_RUN=1）。细粒度令牌，权限仅 Issues: Read and write，
 *                         仓库仅限本反馈仓。
 *   GITHUB_REPO           默认 Paltrow-Studio/ShotaPartner-Docs
 *   PORT                  默认 8787
 *   ALLOWED_ORIGINS       允许的来源，逗号分隔；默认站点正式域名与本地预览
 *   RATE_LIMIT_PER_HOUR   单 IP 每小时上限，默认 5
 *   RELAY_SECRET          可选；设置后要求请求头 X-Relay-Key 一致（对静态页无遮蔽作用，
 *                         仅用于挡掉直接扫端口的脚本）
 *   DRY_RUN               设为 1 时只校验并回显，不调用 GitHub API
 *   GITHUB_API_BASE       默认 https://api.github.com；仅用于本地联调或 GitHub Enterprise
 *
 * 启动：GITHUB_TOKEN=xxx node relay/server.mjs
 * 自测：DRY_RUN=1 node relay/server.mjs &  然后 curl POST /issue
 */

import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'

const REPO = process.env.GITHUB_REPO ?? 'Paltrow-Studio/ShotaPartner-Docs'
const PORT = Number(process.env.PORT ?? 8787)
const DRY_RUN = process.env.DRY_RUN === '1'
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 5)
const RELAY_SECRET = process.env.RELAY_SECRET ?? ''
const TOKEN = process.env.GITHUB_TOKEN ?? ''
const API_BASE = (process.env.GITHUB_API_BASE ?? 'https://api.github.com').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  'https://paltrow-studio.github.io,http://localhost:4177,http://127.0.0.1:4177'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const MAX_BODY_BYTES = 32 * 1024
const TITLE_MAX = 120
const BODY_MAX = 8000

/** 类型 → 标签。标签由服务端决定，客户端传来的标签一律忽略。 */
const LABELS = ['needs-triage']


const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const windowStart = now - 3600_000
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart)
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list)
    return true
  }
  list.push(now)
  hits.set(ip, list)
  // 防止 Map 无界增长
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (!value.some((t) => t > windowStart)) hits.delete(key)
    }
  }
  return false
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-relay-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function send(res, status, payload, origin) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...corsHeaders(origin),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function secretOk(req) {
  if (!RELAY_SECRET) return true
  const given = req.headers['x-relay-key'] ?? ''
  const a = Buffer.from(String(given))
  const b = Buffer.from(RELAY_SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 校验并规整客户端草稿；返回 { payload } 或 { error } */
function validate(input) {
  if (!input || typeof input !== 'object') return { error: '请求体不是 JSON 对象' }
  // 蜜罐：正常用户看不到这个字段，填了就丢弃
  if (String(input.honeypot ?? '').trim() !== '') return { error: '提交被拒绝' }

  const title = String(input.title ?? '').replace(/\s+/g, ' ').trim()
  if (title.length < 4) return { error: '标题至少 4 个字' }
  if (title.length > TITLE_MAX) return { error: `标题不超过 ${TITLE_MAX} 个字` }

  const version = String(input.version ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!version) return { error: '请填写版本' }

  const content = String(input.content ?? '').trim()
  if (content.length < 20) return { error: '内容太短：请写清现象与复现步骤' }
  if (content.length > BODY_MAX) return { error: `内容不超过 ${BODY_MAX} 个字` }

  const contact = String(input.contact ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const prefix = String(input.titlePrefix ?? '').trim().slice(0, 24)

  const body = [
    `### 版本`,
    version,
    '',
    `### 内容`,
    content,
    '',
    '---',
    `经站点反馈区中继提交（${new Date().toISOString()}）`,
    ...(contact ? [`联系方式：${contact}`] : []),
  ].join('\n')

  return { payload: { title: `${prefix ? `${prefix} ` : ''}${title}`.slice(0, TITLE_MAX), body, labels: [...LABELS] } }
}

async function createIssue(payload) {
  const res = await fetch(`${API_BASE}/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ShotaPartner-Docs-Relay',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 上游返回非 JSON */
  }
  if (!res.ok) {
    return { error: `GitHub API ${res.status}`, detail: json?.message ?? text.slice(0, 300) }
  }
  return { issue: { number: json.number, url: json.html_url } }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin ?? ''
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin))
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, { ok: true, repo: REPO, dryRun: DRY_RUN, time: new Date().toISOString() }, origin)
    return
  }

  if (req.method !== 'POST' || url.pathname !== '/issue') {
    send(res, 404, { ok: false, error: 'not found' }, origin)
    return
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    send(res, 403, { ok: false, error: '来源不在允许列表内' }, origin)
    return
  }
  if (!secretOk(req)) {
    send(res, 403, { ok: false, error: 'X-Relay-Key 不正确' }, origin)
    return
  }
  if (!DRY_RUN && !TOKEN) {
    send(res, 500, { ok: false, error: '服务端未配置 GITHUB_TOKEN' }, origin)
    return
  }

  let raw
  try {
    raw = await readBody(req)
  } catch {
    send(res, 413, { ok: false, error: '请求体过大' }, origin)
    return
  }

  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    send(res, 400, { ok: false, error: '请求体不是合法 JSON' }, origin)
    return
  }

  const checked = validate(input)
  if (checked.error) {
    send(res, 400, { ok: false, error: checked.error }, origin)
    return
  }

  // 限流放在校验之后：格式错误、蜜罐命中的请求不消耗配额，
  // 不然一次手误就会把同一网络下的正常提交一起挡掉。
  const ip = req.socket.remoteAddress ?? 'unknown'
  if (rateLimited(ip)) {
    send(res, 429, { ok: false, error: `提交过于频繁，每小时最多 ${RATE_LIMIT} 条` }, origin)
    return
  }

  if (DRY_RUN) {
    send(res, 200, { ok: true, dryRun: true, wouldCreate: checked.payload }, origin)
    return
  }

  try {
    const result = await createIssue(checked.payload)
    if (result.error) {
      send(res, 502, { ok: false, error: result.error, detail: result.detail }, origin)
      return
    }
    send(res, 201, { ok: true, issue: result.issue }, origin)
  } catch (error) {
    send(res, 502, { ok: false, error: `无法连接 ${API_BASE}`, detail: String(error).slice(0, 200) }, origin)
  }
})

server.listen(PORT, () => {
  console.log(`反馈中继已启动：http://127.0.0.1:${PORT}  仓库=${REPO}  dryRun=${DRY_RUN}`)
  console.log(`允许来源：${ALLOWED_ORIGINS.join(', ')}`)
  console.log(`单 IP 限流：${RATE_LIMIT} 条/小时${RELAY_SECRET ? '  已启用 X-Relay-Key' : ''}`)
})
