/**
 * 反馈中继（Cloudflare Worker 版）。
 *
 * 与 relay/server.mjs 同一份接口契约：
 *   GET  /health → { ok, repo, dryRun, time }
 *   POST /issue  → { ok, issue: { number, url } }
 *
 * 部署（需要 Cloudflare 账号）：
 *   cd relay && npx wrangler deploy worker.js --name shota-feedback-relay \
 *     --compatibility-date 2026-09-01
 *   npx wrangler secret put GITHUB_TOKEN
 * 其余变量用 plain_text：GITHUB_REPO / ALLOWED_ORIGINS / RATE_LIMIT_PER_HOUR / RELAY_SECRET。
 *
 * 注意：Worker 的模块级内存只在单个 isolate 内有效，跨边缘节点不共享，
 * 因此这里的限流是尽力而为。需要严格限流请改用 Durable Object / KV，
 * 或打开 Cloudflare Turnstile 并把校验放在本文件开头。
 */

const TITLE_MAX = 120
const BODY_MAX = 8000
const MAX_BODY_BYTES = 32 * 1024

const TYPE_LABELS = {
  bug: ['bug', 'needs-triage'],
  crash: ['crash', 'needs-triage'],
  compatibility: ['compatibility', 'needs-triage'],
  feature: ['enhancement', 'needs-triage'],
}
const MODULE_LABELS = { core: 'module:core', api: 'module:api', school: 'module:school' }

const hits = new Map()

function rateLimited(ip, limit) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => t > now - 3600_000)
  if (list.length >= limit) {
    hits.set(ip, list)
    return true
  }
  list.push(now)
  hits.set(ip, list)
  return false
}

function cors(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-relay-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

function validate(input) {
  if (!input || typeof input !== 'object') return { error: '请求体不是 JSON 对象' }
  const type = String(input.type ?? '')
  if (!TYPE_LABELS[type]) return { error: 'type 必须是 bug / crash / compatibility / feature' }
  const moduleId = String(input.module ?? 'unknown')
  if (moduleId !== 'unknown' && !MODULE_LABELS[moduleId]) return { error: 'module 取值非法' }
  if (String(input.honeypot ?? '').trim() !== '') return { error: '提交被拒绝' }

  const summary = String(input.summary ?? '').replace(/\s+/g, ' ').trim()
  if (summary.length < 4) return { error: '问题概述至少 4 个字' }
  if (summary.length > TITLE_MAX) return { error: `问题概述不超过 ${TITLE_MAX} 个字` }

  const body = String(input.body ?? '').trim()
  if (body.length < 20) return { error: '正文太短，请至少填写环境与复现步骤' }
  if (body.length > BODY_MAX) return { error: `正文不超过 ${BODY_MAX} 个字` }

  const contact = String(input.contact ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const prefix = String(input.titlePrefix ?? '').trim().slice(0, 24)
  const moduleTag = String(input.moduleTag ?? '').trim().slice(0, 24)

  const title = `${prefix ? `${prefix} ` : ''}${moduleTag ? `[${moduleTag}] ` : ''}${summary}`.slice(0, TITLE_MAX)
  const labels = [...TYPE_LABELS[type], ...(MODULE_LABELS[moduleId] ? [MODULE_LABELS[moduleId]] : [])]
  const footer = ['---', `经站点反馈区中继提交（${new Date().toISOString()}）`]
  if (contact) footer.push(`联系方式：${contact}`)

  return { payload: { title, body: `${body}\n\n${footer.join('\n')}`, labels } }
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS ?? 'https://paltrow-studio.github.io')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const origin = request.headers.get('Origin') ?? ''
    const headers = cors(origin, allowed)
    const url = new URL(request.url)
    const dryRun = env.DRY_RUN === '1'
    const repo = env.GITHUB_REPO ?? 'Paltrow-Studio/ShotaPartner-Docs'
    const apiBase = (env.GITHUB_API_BASE ?? 'https://api.github.com').replace(/\/+$/, '')
    const limit = Number(env.RATE_LIMIT_PER_HOUR ?? 5)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, repo, dryRun, time: new Date().toISOString() }, 200, headers)
    }
    if (request.method !== 'POST' || url.pathname !== '/issue') {
      return json({ ok: false, error: 'not found' }, 404, headers)
    }
    if (origin && !allowed.includes(origin)) {
      return json({ ok: false, error: '来源不在允许列表内' }, 403, headers)
    }
    if (env.RELAY_SECRET && request.headers.get('x-relay-key') !== env.RELAY_SECRET) {
      return json({ ok: false, error: 'X-Relay-Key 不正确' }, 403, headers)
    }
    if (!dryRun && !env.GITHUB_TOKEN) {
      return json({ ok: false, error: '服务端未配置 GITHUB_TOKEN' }, 500, headers)
    }

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: '请求体过大' }, 413, headers)

    let input
    try {
      input = JSON.parse(raw || '{}')
    } catch {
      return json({ ok: false, error: '请求体不是合法 JSON' }, 400, headers)
    }

    const checked = validate(input)
    if (checked.error) return json({ ok: false, error: checked.error }, 400, headers)

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (rateLimited(ip, limit)) {
      return json({ ok: false, error: `提交过于频繁，每小时最多 ${limit} 条` }, 429, headers)
    }

    if (dryRun) return json({ ok: true, dryRun: true, wouldCreate: checked.payload }, 200, headers)

    const res = await fetch(`${apiBase}/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'ShotaPartner-Docs-Relay',
      },
      body: JSON.stringify(checked.payload),
    })
    const text = await res.text()
    if (!res.ok) {
      let detail = text.slice(0, 300)
      try {
        detail = JSON.parse(text).message ?? detail
      } catch {
        /* 非 JSON 响应 */
      }
      return json({ ok: false, error: `GitHub API ${res.status}`, detail }, 502, headers)
    }
    const issue = JSON.parse(text)
    return json({ ok: true, issue: { number: issue.number, url: issue.html_url } }, 201, headers)
  },
}
