#!/usr/bin/env node
/**
 * 中继自测：在 DRY_RUN 模式下拉起 server.mjs，逐条校验接口行为。
 * 不访问 GitHub，不需要令牌。用法：node relay/selftest.mjs
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8799
const BASE = `http://127.0.0.1:${PORT}`

const longBody = '### 环境\n- 模组版本：0.3.1\n- Forge 版本：47.2.0\n\n### 复现步骤\n1. 派工\n2. 丢出物品\n'

const cases = [
  {
    name: '健康检查',
    req: { path: '/health' },
    expect: { status: 200, ok: true },
  },
  {
    name: '正常提交（标签由服务端决定，客户端传的标签被忽略）',
    req: {
      path: '/issue',
      body: {
        type: 'bug',
        module: 'core',
        summary: '伙伴在工作时不会拾取掉落物',
        body: longBody,
        labels: ['伪造标签'],
        titlePrefix: '[Bug]',
      },
    },
    expect: { status: 200, ok: true, labels: ['bug', 'needs-triage', 'module:core'] },
  },
  {
    name: '未知模块不打模块标签',
    req: { path: '/issue', body: { type: 'crash', module: 'unknown', summary: '启动即崩溃的问题', body: longBody } },
    expect: { status: 200, ok: true, labels: ['crash', 'needs-triage'] },
  },
  { name: '类型非法', req: { path: '/issue', body: { type: 'x', summary: '标题内容', body: longBody } }, expect: { status: 400 } },
  { name: '标题过短', req: { path: '/issue', body: { type: 'bug', summary: '短', body: longBody } }, expect: { status: 400 } },
  { name: '正文过短', req: { path: '/issue', body: { type: 'bug', summary: '正常标题内容', body: '太短' } }, expect: { status: 400 } },
  {
    name: '蜜罐命中',
    req: { path: '/issue', body: { type: 'bug', summary: '正常标题内容', body: longBody, honeypot: 'bot' } },
    expect: { status: 400 },
  },
  { name: '非 JSON', req: { path: '/issue', raw: 'not json' }, expect: { status: 400 } },
  {
    name: '来源不允许',
    req: { path: '/issue', origin: 'https://evil.example', body: { type: 'bug', summary: '正常标题内容', body: longBody } },
    expect: { status: 403 },
  },
  { name: '未知路径', req: { path: '/nope' }, expect: { status: 404 } },
]

function check(name, actual, expect) {
  const problems = []
  if (actual.status !== expect.status) problems.push(`状态码 ${actual.status} != ${expect.status}`)
  if (expect.ok !== undefined && actual.json?.ok !== expect.ok) problems.push(`ok=${actual.json?.ok} != ${expect.ok}`)
  if (expect.labels) {
    const got = actual.json?.wouldCreate?.labels
    if (JSON.stringify(got) !== JSON.stringify(expect.labels)) problems.push(`标签 ${JSON.stringify(got)}`)
  }
  console.log(`${problems.length ? '✗' : '✓'} ${name}${problems.length ? ` — ${problems.join('；')}` : ''}`)
  return problems.length === 0
}

async function request(base, req) {
  const init = { method: req.path === '/health' ? 'GET' : 'POST' }
  if (req.body || req.raw) {
    init.headers = { 'content-type': 'application/json' }
    if (req.origin) init.headers.origin = req.origin
    init.body = req.raw ?? JSON.stringify(req.body)
  }
  const res = await fetch(`${base}${req.path}`, init)
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function waitReady(child) {
  await new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('已启动')) resolve()
    })
    setTimeout(resolve, 3000)
  })
}

const server = spawn(process.execPath, [path.join(here, 'server.mjs')], {
  env: { ...process.env, DRY_RUN: '1', PORT: String(PORT), RATE_LIMIT_PER_HOUR: '100' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await waitReady(server)

let failed = 0
for (const item of cases) {
  const actual = await request(BASE, item.req)
  if (!check(item.name, actual, item.expect)) failed += 1
}
server.kill('SIGTERM')

// 限流：上限 1 条。先来两次无效提交（不得消耗配额），再两次有效提交（第二次 429）
const ratePort = PORT + 1
const rateBase = `http://127.0.0.1:${ratePort}`
const rateServer = spawn(process.execPath, [path.join(here, 'server.mjs')], {
  env: { ...process.env, DRY_RUN: '1', PORT: String(ratePort), RATE_LIMIT_PER_HOUR: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await waitReady(rateServer)

await request(rateBase, { path: '/issue', raw: 'not json' })
await request(rateBase, { path: '/issue', body: { type: 'bug', summary: '短', body: longBody } })
const first = await request(rateBase, {
  path: '/issue',
  body: { type: 'bug', module: 'core', summary: '限流测试第一条', body: longBody },
})
const second = await request(rateBase, {
  path: '/issue',
  body: { type: 'bug', module: 'core', summary: '限流测试第二条', body: longBody },
})
const invalid = await request(rateBase, { path: '/issue', raw: 'not json' })

const limitOk =
  first.status === 200 && second.status === 429 && invalid.status === 400
console.log(
  `${limitOk ? '✓' : '✗'} 限流：无效请求不消耗配额（${invalid.status}），有效请求上限 1 条（${first.status} → ${second.status}）`,
)
if (!limitOk) failed += 1
rateServer.kill('SIGTERM')

console.log(`\n共 ${cases.length + 1} 项，失败 ${failed} 项`)
process.exit(failed === 0 ? 0 : 1)
