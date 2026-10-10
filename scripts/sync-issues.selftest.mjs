#!/usr/bin/env node
/**
 * GitHub Actions 同步脚本自测（零依赖，不需要网络）。
 *
 *   node scripts/sync-issues.selftest.mjs
 *
 * 做法：把 globalThis.fetch 换成一个按 URL 分流的路由器——
 *   反馈服务地址 → 内存版 /records /status /link /import
 *   api.github.com → 内存版 GitHub REST（与 service/github.selftest 同规格）
 * 然后像 workflow 里那样调 syncOnce，验证「HTTP 写回」这套回调接对了。
 *
 * 覆盖：配置校验（跳过 / 报错）、建 issue 后 /link 写回、幂等、
 * 推送状态走 /status、回读走 /status、导入走 /import、写回失败进 problems。
 */

import { formatSummary, loadConfig, syncOnce } from './sync-issues.mjs'

let passed = 0
let failed = 0

function check(ok, label, detail = '') {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? `（${detail}）` : ''}`)
  }
}

function show(value) {
  try {
    return String(JSON.stringify(value) ?? value).slice(0, 300)
  } catch {
    return String(value)
  }
}

/* ---------- 假服务与假 GitHub ---------- */

const FEEDBACK = 'http://feedback.test'
const ADMIN_KEY = 'sync-admin-key'
const TOKEN = 'ghp_sync_selftest'
const REPO = 'Paltrow-Studio/ShotaPartner-Docs'
const API = 'https://api.github.com'

function record(id, extra = {}) {
  return {
    id,
    title: '伙伴不拾取掉落物',
    version: '0.3.1（当前版本）',
    content: '工作状态下不拾取掉落物，站着不动也会一直触发工作动画。',
    status: 'pending',
    images: [],
    createdAt: '2026-10-03T04:00:00.000Z',
    updatedAt: '2026-10-03T04:00:00.000Z',
    ...extra,
  }
}

/**
 * 路由器：反馈服务与 GitHub 各一套内存实现。
 * 写回端点（status/link/import）会校验管理密钥，用来验证脚本真的带了密钥。
 */
function installFakes(seedRecords) {
  const service = {
    records: seedRecords.map((item) => ({ ...item })),
    /** 收到的写回请求，供断言「改动走了哪个端点」 */
    writes: [],
  }
  const github = { labels: new Set(), issues: [], nextNumber: 1 }

  const respond = (status, payload) => ({ ok: status < 400, status, json: async () => payload })

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    const method = String(init.method ?? 'GET').toUpperCase()
    const headers = init.headers ?? {}
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null

    /* ---- 反馈服务 ---- */
    if (url.origin === FEEDBACK) {
      if (url.pathname === '/records' && method === 'GET') {
        // 公开响应：不带联系方式，且返回副本（真实 HTTP 天然如此，避免共享引用掩盖写回）
        return respond(200, {
          ok: true,
          total: service.records.length,
          records: service.records.map((item) => ({ ...item })),
        })
      }
      if (method === 'POST' && ['/status', '/link', '/import'].includes(url.pathname)) {
        if (headers['x-admin-key'] !== ADMIN_KEY) {
          return respond(403, { ok: false, error: '管理密钥不正确' })
        }
        service.writes.push({ path: url.pathname, body })
        if (url.pathname === '/status') {
          const target = service.records.find((item) => item.id === body.id)
          if (!target) return respond(404, { ok: false, error: `没有编号为 ${body.id} 的记录` })
          target.status = body.status
          target.updatedAt = new Date().toISOString()
          return respond(200, { ok: true, record: target })
        }
        if (url.pathname === '/link') {
          const target = service.records.find((item) => item.id === body.id)
          if (!target) return respond(404, { ok: false, error: `没有编号为 ${body.id} 的记录` })
          target.issueUrl = body.issueUrl
          return respond(200, { ok: true, record: target })
        }
        // /import：按编号幂等
        let imported = 0
        let skipped = 0
        for (const item of body.records ?? []) {
          if (service.records.some((exist) => exist.id === item.id)) {
            skipped += 1
            continue
          }
          service.records.push(item)
          imported += 1
        }
        return respond(200, { ok: true, imported, skipped, problems: [] })
      }
      return respond(404, { ok: false, error: '没有这个接口' })
    }

    /* ---- GitHub ---- */
    if (url.origin === API) {
      if (headers.authorization !== `Bearer ${TOKEN}`) return respond(401, { message: 'Bad credentials' })

      if (url.pathname.endsWith('/labels')) {
        if (method === 'GET') return respond(200, { labels: [...github.labels].map((name) => ({ name })) })
        if (method === 'POST') {
          github.labels.add(body.name)
          return respond(201, { name: body.name })
        }
      }
      if (url.pathname.endsWith('/issues') && method === 'GET') {
        const wanted = url.searchParams.get('labels')
        const list = wanted
          ? github.issues.filter((issue) => issue.labels.some((label) => label.name === wanted))
          : github.issues
        return respond(200, list)
      }
      if (url.pathname.endsWith('/issues') && method === 'POST') {
        const now = new Date().toISOString()
        const number = github.nextNumber++
        const issue = {
          number,
          title: body.title,
          body: body.body,
          state: 'open',
          labels: (body.labels ?? []).map((name) => ({ name })),
          html_url: `https://github.com/${REPO}/issues/${number}`,
          created_at: now,
          updated_at: now,
        }
        github.issues.push(issue)
        return respond(201, issue)
      }
      const one = /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/.exec(url.pathname)
      if (one && method === 'PATCH') {
        const issue = github.issues.find((item) => item.number === Number(one[1]))
        if (!issue) return respond(404, { message: 'Not Found' })
        if (body.state) issue.state = body.state
        if (body.labels) issue.labels = body.labels.map((name) => ({ name }))
        issue.updated_at = new Date().toISOString()
        return respond(200, issue)
      }
      if (one && method === 'GET') {
        const issue = github.issues.find((item) => item.number === Number(one[1]))
        return issue ? respond(200, issue) : respond(404, { message: 'Not Found' })
      }
      return respond(404, { message: `假 GitHub 没有实现 ${method} ${url.pathname}` })
    }

    throw new Error(`自测收到了意外的地址：${url}`)
  }

  return { service, github }
}

async function main() {
  const originalFetch = globalThis.fetch
  try {
    /* 1. 配置校验 */
    const skip = loadConfig({})
    check(typeof skip.skip === 'string' && skip.skip.includes('FEEDBACK_API'), '没配反馈服务地址 → 跳过而非报错', show(skip))
    let error = ''
    try {
      loadConfig({ FEEDBACK_URL: FEEDBACK })
    } catch (caught) {
      error = caught.message
    }
    check(error.includes('ADMIN_KEY'), '缺 ADMIN_KEY → 报配置错误', error)
    error = ''
    try {
      loadConfig({ FEEDBACK_URL: FEEDBACK, ADMIN_KEY })
    } catch (caught) {
      error = caught.message
    }
    check(error.includes('GITHUB_TOKEN'), '缺 GITHUB_TOKEN → 报配置错误', error)
    const ready = loadConfig({ FEEDBACK_URL: `${FEEDBACK}/`, ADMIN_KEY, GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: REPO })
    check(ready.config?.repo === REPO, 'GITHUB_REPOSITORY 兜底目标仓库', ready.config?.repo)
    check(ready.config?.baseUrl === FEEDBACK, '截图绝对地址默认取反馈服务地址（去尾斜杠）', ready.config?.baseUrl)

    /* 2. 建 issue → /link 写回 */
    const fakes = installFakes([record('F-0001')])
    const env = { FEEDBACK_URL: FEEDBACK, ADMIN_KEY, GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: REPO }
    const first = await syncOnce(env)
    check(first.created === 1 && first.problems.length === 0, '首轮：给 F-0001 建 issue', show(first))
    check(fakes.github.issues.length === 1, '假 GitHub 收到 1 条 issue', String(fakes.github.issues.length))
    const linkWrite = fakes.service.writes.find((write) => write.path === '/link')
    check(
      linkWrite?.body?.id === 'F-0001' && /\/issues\/\d+$/.test(linkWrite?.body?.issueUrl ?? ''),
      'issueUrl 通过 POST /link 写回',
      show(linkWrite),
    )
    check(
      fakes.service.records[0].issueUrl === fakes.github.issues[0].html_url,
      '服务端记录的 issueUrl 与 GitHub 一致',
      fakes.service.records[0].issueUrl,
    )
    const body = fakes.github.issues[0].body ?? ''
    check(!body.includes('undefined'), 'issue 正文没有 undefined（字段都接上了）', body.slice(0, 160))

    /* 3. 幂等 */
    const writesBefore = fakes.service.writes.length
    const second = await syncOnce(env)
    check(
      second.created === 0 && second.pushed === 0 && second.pulled === 0 && second.unchanged === 1,
      '再跑一轮 → 无变化',
      show(second),
    )
    check(fakes.service.writes.length === writesBefore, '无变化的一轮不发任何写回请求')

    /* 4. 推：服务端状态先变了 → workflow 只需把 GitHub 侧推齐（不回写 /status） */
    fakes.service.records[0].status = 'fixed'
    fakes.service.records[0].updatedAt = new Date(Date.now() + 60_000).toISOString()
    const pushed = await syncOnce(env)
    check(pushed.pushed === 1, '状态更新 → 推送', show(pushed))
    check(
      !fakes.service.writes.some((write) => write.path === '/status'),
      '推送方向不回写 /status（记录本来就是对的）',
      show(fakes.service.writes),
    )
    check(fakes.github.issues[0].state === 'closed', 'GitHub issue 随之关闭', fakes.github.issues[0].state)
    check(
      fakes.github.issues[0].labels.some((label) => label.name === '已修复'),
      '标签换成「已修复」',
      show(fakes.github.issues[0].labels),
    )

    /* 5. 回读：在 GitHub 上改状态 → /status 写回记录 */
    const issue = fakes.github.issues[0]
    issue.state = 'open'
    issue.labels = [{ name: '反馈' }, { name: '排查中' }]
    issue.updated_at = new Date(Date.now() + 60_000).toISOString()
    fakes.service.records[0].updatedAt = '2020-01-01T00:00:00.000Z'
    const pulled = await syncOnce(env)
    check(pulled.pulled === 1, 'GitHub 侧更新 → 回读', show(pulled))
    const pullWrites = fakes.service.writes.filter((write) => write.path === '/status')
    check(
      pullWrites.some((write) => write.body.status === 'investigating'),
      '回读经 POST /status 落到记录',
      show(pullWrites.at(-1)),
    )
    check(fakes.service.records[0].status === 'investigating', '记录状态已更新', fakes.service.records[0].status)

    /* 6. 导入：有人直接在 GitHub 上开了带标签的 issue */
    fakes.github.issues.push({
      number: 42,
      title: '玩家直接开的 issue',
      body: '### 版本\n\n0.2.0\n\n### 内容\n\n一进学校维度就崩溃，日志链接在下面。',
      state: 'open',
      labels: [{ name: '反馈' }],
      html_url: `https://github.com/${REPO}/issues/42`,
      created_at: '2026-10-02T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    })
    const imported = await syncOnce(env)
    const importWrite = fakes.service.writes.find((write) => write.path === '/import')
    check(imported.imported === 1, '带标签的新 issue → 导入记录', show(imported))
    check(importWrite?.body?.records?.[0]?.id === 'F-0002', '导入经 POST /import 且拿到下一个编号', show(importWrite?.body?.records?.[0]?.id))
    check(fakes.service.records.some((item) => item.id === 'F-0002'), '服务端多了一条记录')
    const again = await syncOnce(env)
    check(again.imported === 0, '重复跑不再导入同一条', show(again))

    /* 7. 写回失败进 problems，不中断整轮（回读方向走 /status） */
    const failingIssue = fakes.github.issues[0]
    failingIssue.state = 'closed'
    failingIssue.labels = [{ name: '反馈' }, { name: '已关闭' }]
    failingIssue.updated_at = new Date(Date.now() + 120_000).toISOString()
    const brokenFetch = globalThis.fetch
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input))
      if (url.origin === FEEDBACK && url.pathname === '/status') {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: '管理密钥不正确' }),
        }
      }
      return brokenFetch(input, init)
    }
    const failing = await syncOnce(env)
    check(
      failing.problems.length === 1 && failing.problems[0].includes('403'),
      '回读写回被拒 → 记进 problems 且带状态码',
      show(failing.problems),
    )
    check(failing.checked >= 1, '整轮没有被写回失败打断', String(failing.checked))
    check(
      fakes.service.records[0].status === 'investigating',
      '写回失败时记录保持原状',
      fakes.service.records[0].status,
    )
    globalThis.fetch = brokenFetch

    /* 8. 摘要格式 */
    check(formatSummary({ skipped: '没配' }) === '没配', 'skip 摘要原样输出')
    check(
      formatSummary({ checked: 1, created: 0, linked: 0, imported: 0, pushed: 0, pulled: 0, unchanged: 1, problems: [] }).includes('无变化 1'),
      '摘要含各分支计数',
      formatSummary({ checked: 1, created: 0, linked: 0, imported: 0, pushed: 0, pulled: 0, unchanged: 1, problems: [] }),
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  console.log('')
  console.log(`通过 ${passed} / ${passed + failed}`)
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error(`自测中断：${error.stack ?? error}`)
  process.exit(1)
})
