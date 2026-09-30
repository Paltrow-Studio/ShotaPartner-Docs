#!/usr/bin/env node
/**
 * 远程中继自检：部署完成后验证线上服务是否可用、CORS 是否正确、校验是否生效。
 * 用法：
 *   node relay/verify-remote.mjs https://relay.example.com
 *   node relay/verify-remote.mjs https://relay.example.com --live   # 追加真实提交（会创建一条 issue）
 *
 * 不带 --live 时不会在 GitHub 上留下任何内容。
 */

const base = (process.argv[2] ?? '').replace(/\/+$/, '')
const live = process.argv.includes('--live')
const origin = process.env.SITE_ORIGIN ?? 'https://paltrow-studio.github.io'

if (!base.startsWith('https://') && !base.startsWith('http://')) {
  console.error('用法：node relay/verify-remote.mjs https://relay.example.com [--live]')
  process.exit(2)
}

let failed = 0
function report(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed += 1
}

// 1. 健康检查
let health = null
try {
  const started = Date.now()
  const res = await fetch(`${base}/health`, { headers: { origin } })
  health = await res.json()
  const ms = Date.now() - started
  report('健康检查', res.ok && health.ok === true, `${ms} ms，仓库=${health.repo}，dryRun=${health.dryRun}`)
  report('允许来源回显', res.headers.get('access-control-allow-origin') === origin, res.headers.get('access-control-allow-origin') ?? '缺失')
  report('生产模式（dryRun=false）', health.dryRun === false, health.dryRun ? '当前是 DRY_RUN，不会真的建 issue' : '')
} catch (error) {
  report('健康检查', false, `无法连接 ${base}：${String(error).slice(0, 120)}`)
  process.exit(1)
}

// 2. 预检
try {
  const res = await fetch(`${base}/issue`, {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
  })
  report('OPTIONS 预检', res.status === 204, `状态码 ${res.status}`)
} catch (error) {
  report('OPTIONS 预检', false, String(error).slice(0, 120))
}

// 3. 校验：非法类型必须被拒
{
  const res = await fetch(`${base}/issue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ type: 'x', summary: '自检非法类型', body: '这段正文长度足够通过最小长度校验的要求。' }),
  })
  const json = await res.json().catch(() => null)
  report('非法类型被拒', res.status === 400, `状态码 ${res.status} ${json?.error ?? ''}`)
}

// 4. 蜜罐必须被拒
{
  const res = await fetch(`${base}/issue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      type: 'bug',
      summary: '自检蜜罐字段',
      body: '这段正文长度足够通过最小长度校验的要求。',
      honeypot: 'bot',
    }),
  })
  report('蜜罐被拒', res.status === 400, `状态码 ${res.status}`)
}

// 5. 来源白名单
{
  const res = await fetch(`${base}/issue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ type: 'bug', summary: '自检来源白名单', body: '这段正文长度足够通过最小长度校验的要求。' }),
  })
  report('非法来源被拒', res.status === 403, `状态码 ${res.status}`)
}

// 6. 真实提交（可选）
if (live) {
  const res = await fetch(`${base}/issue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      type: 'bug',
      module: 'unknown',
      summary: '中继链路自检，可关闭',
      body: '这条 issue 由 relay/verify-remote.mjs --live 创建，用于验证中继权限与链路，确认后可直接关闭。\n',
      titlePrefix: '[Bug]',
      moduleTag: '中继自检',
    }),
  })
  const json = await res.json().catch(() => null)
  report('真实提交', res.status === 201 && json?.ok === true, json?.issue?.url ?? json?.error ?? `状态码 ${res.status}`)
} else {
  console.log('· 未加 --live，跳过真实提交（不会在 GitHub 上创建内容）')
}

console.log(`\n${failed === 0 ? '全部通过' : `失败 ${failed} 项`}`)
process.exit(failed === 0 ? 0 : 1)
