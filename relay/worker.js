/**
 * 反馈中继（Cloudflare Worker 版）。
 *
 * 与 relay/server.mjs 同一份接口契约：
 *   GET  /health → { ok, repo, dryRun, time }
 *   POST /issue  → { ok, issue: { number, url } }
 *
 * 部署（需要 Cloudflare 账号；推荐绑自有域名，workers.dev 在国内不稳定）：
 *   cd relay
 *   npx wrangler deploy                       # 读取同目录 wrangler.toml
 *   npx wrangler secret put GITHUB_TOKEN      # 细粒度令牌，仅 Issues 写
 * 变量在 wrangler.toml 的 [vars] 里：GITHUB_REPO / ALLOWED_ORIGINS /
 * RATE_LIMIT_PER_HOUR / GITHUB_API_BASE。RELAY_SECRET 也用 secret put 下发。
 *
 * 限流：绑定 KV 后跨边缘节点共享计数，见 wrangler.toml 中注释掉的 kv_namespaces；
 * 未绑定时退回模块级内存（单 isolate 有效），属于尽力而为。要更严格的防护可叠加
 * Cloudflare Turnstile，把校验放在本文件开头。
 */

const TITLE_MAX = 120
const BODY_MAX = 8000
const MAX_BODY_BYTES = 32 * 1024

const LABELS = ['needs-triage']

const hits = new Map()

/**
 * 限流。绑定了 KV（RATE_KV）时用它，计数在各边缘节点之间共享；
 * 没绑定时退回模块级内存，只在单个 isolate 内有效。
 * KV 的读写在并发下不是原子的，属于尽力而为；要严格限流请改 Durable Object。
 */
async function rateLimited(env, ip, limit) {
  if (env.RATE_KV) {
    const key = `rl:${ip}`
    const current = Number((await env.RATE_KV.get(key)) ?? 0)
    if (current >= limit) return true
    await env.RATE_KV.put(key, String(current + 1), { expirationTtl: 3600 })
    return false
  }
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
    if (await rateLimited(env, ip, limit)) {
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
