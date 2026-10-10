#!/usr/bin/env node
/**
 * GitHub 同步层自测（零依赖，不需要网络）。
 *
 *   node service/github.selftest.mjs
 *
 * 做法：把 globalThis.fetch 换成一个内存版的 GitHub REST 实现，然后像真的一样
 * 调 runSync —— 不监听端口、不 spawn 进程，因此在任何沙箱里都能跑。
 * 假实现只做四件事：标签列表 / 建标签、issue 列表 / 建 / 改，全部带鉴权检查。
 *
 * 覆盖：配置开关、状态映射双向、正文不含联系方式、记录 ↔ issue 的建 / 推 /
 * 回读 / 导入四条路径、幂等、早期记录不镜像、未配置时直接报错。
 */

import {
  githubConfig,
  issueBody,
  issueTitle,
  issueToStatus,
  recordFromIssue,
  runSync,
  statusToIssue,
} from './github.mjs'
import { recordProblems } from './store.mjs'

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

/* ---------- 假 GitHub ---------- */

const API = 'https://api.github.com'
const REPO = 'Paltrow-Studio/ShotaPartner-Docs'
const TOKEN = 'ghp_selftest'

/**
 * 替换 globalThis.fetch，模拟 github.mjs 用到的那几个端点。
 * 返回的对象只带 github.mjs 真正读的三个属性：ok / status / json()。
 */
function installFakeGithub() {
  const state = {
    /** @type {Set<string>} */
    labels: new Set(),
    /** @type {object[]} */
    issues: [],
    nextNumber: 1,
    /** 每次调用的记录，用来断言「发了什么」 */
    calls: [],
  }
  const iso = () => new Date().toISOString()
  const respond = (status, payload) => ({ ok: status < 400, status, json: async () => payload })

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    const method = String(init.method ?? 'GET').toUpperCase()
    const headers = init.headers ?? {}
    const auth = headers.authorization ?? headers.Authorization
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
    state.calls.push({ method, path: url.pathname + url.search, body })

    if (url.origin !== API) return respond(404, { message: `假 GitHub 收到意外的地址：${url}` })
    // 鉴权必须真的带上：token 泄漏进正文或根本不发，都在这里现形
    if (auth !== `Bearer ${TOKEN}`) return respond(401, { message: 'Bad credentials' })

    const labelsPath = /^\/repos\/[^/]+\/[^/]+\/labels$/.exec(url.pathname)
    if (labelsPath) {
      if (method === 'GET') {
        return respond(200, { labels: [...state.labels].map((name) => ({ name })) })
      }
      if (method === 'POST') {
        state.labels.add(body.name)
        return respond(201, { name: body.name })
      }
      return respond(405, { message: 'Method not allowed' })
    }

    const listPath = /^\/repos\/[^/]+\/[^/]+\/issues$/.exec(url.pathname)
    if (listPath) {
      if (method === 'GET') {
        const wanted = url.searchParams.get('labels')
        const list = wanted
          ? state.issues.filter((issue) => issue.labels.some((label) => label.name === wanted))
          : state.issues
        return respond(200, list)
      }
      if (method === 'POST') {
        const now = iso()
        const issue = {
          number: state.nextNumber++,
          title: body.title,
          body: body.body,
          state: 'open',
          labels: (body.labels ?? []).map((name) => ({ name })),
          html_url: `https://github.com/${REPO}/issues/0`.replace(/issues\/0$/, `issues/${state.nextNumber - 1}`),
          created_at: now,
          updated_at: now,
        }
        state.issues.push(issue)
        for (const name of issue.labels) state.labels.add(name.name)
        return respond(201, issue)
      }
    }

    const onePath = /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/.exec(url.pathname)
    if (onePath) {
      const issue = state.issues.find((item) => item.number === Number(onePath[1]))
      if (!issue) return respond(404, { message: 'Not Found' })
      if (method === 'PATCH') {
        if (body.state) issue.state = body.state
        if (body.labels) issue.labels = body.labels.map((name) => ({ name }))
        if (body.title) issue.title = body.title
        issue.updated_at = iso()
        return respond(200, issue)
      }
      if (method === 'GET') return respond(200, issue)
    }

    return respond(404, { message: `假 GitHub 没有实现 ${method} ${url.pathname}` })
  }

  return state
}

/* ---------- 内存存储 ---------- */

function makeStorage(seed = []) {
  const records = seed.map((record) => ({ ...record }))
  return {
    records,
    list: async () => records,
    save: async (record) => {
      if (!records.some((item) => item.id === record.id)) records.push(record)
    },
    nextId: async () => {
      const max = records.reduce((top, record) => Math.max(top, Number(/F-(\d+)/.exec(record.id)?.[1] ?? 0)), 0)
      return `F-${String(max + 1).padStart(4, '0')}`
    },
  }
}

function record(id, extra = {}) {
  return {
    id,
    title: '伙伴不拾取掉落物',
    version: '0.3.1（当前版本）',
    content: '工作状态下不拾取掉落物，站着不动也会一直触发工作动画。',
    contact: 'player@example.com', // 必须永远不出现在发给 GitHub 的内容里
    status: 'pending',
    images: [],
    createdAt: '2026-10-03T04:00:00.000Z',
    updatedAt: '2026-10-03T04:00:00.000Z',
    ...extra,
  }
}

async function main() {
  const originalFetch = globalThis.fetch
  const github = installFakeGithub()
  try {
    /* 1. 配置开关 */
    check(githubConfig({}) === null, '没配 GITHUB_TOKEN → 同步关闭')
    check(githubConfig({ GITHUB_TOKEN: ' ' }) === null, 'token 全是空白 → 同步关闭')
    const config = githubConfig(
      { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO, GITHUB_API_BASE: `${API}/`, PUBLIC_BASE_URL: 'https://fb.example.com/' },
    )
    check(config?.apiBase === API, 'apiBase 去掉结尾斜杠', config?.apiBase)
    check(config?.baseUrl === 'https://fb.example.com', 'baseUrl 去掉结尾斜杠', config?.baseUrl)

    /* 2. 状态映射（双向） */
    const roundtrip = [
      ['pending', 'open', '待处理'],
      ['investigating', 'open', '排查中'],
      ['fixed', 'closed', '已修复'],
      ['closed', 'closed', '已关闭'],
    ]
    for (const [status, state, label] of roundtrip) {
      const mapped = statusToIssue(status)
      check(mapped.state === state && mapped.labels.includes('反馈') && mapped.labels.includes(label),
        `${status} → issue ${state} + ${label}`, show(mapped))
      check(
        issueToStatus({ state, labels: [{ name: '反馈' }, { name: label }] }) === status,
        `issue ${state} + ${label} → ${status}`,
      )
    }
    check(issueToStatus({ state: 'open', labels: [] }) === 'pending', '开放且无标签 → pending')
    check(issueToStatus({ state: 'closed', labels: [] }) === 'closed', '关闭且无标签 → closed')
    check(issueToStatus({ state: 'closed', labels: ['状态:已修复', '已修复'] }) === 'fixed', '关闭 + 已修复 → fixed')

    /* 3. 正文拼装：隐私与图片 */
    const body = issueBody(record('F-0001', { images: ['/media/f-0001-1.webp'] }), config)
    check(!body.includes('player@example.com'), 'issue 正文不含联系方式')
    check(!body.includes('contact'), 'issue 正文不含 contact 字段名')
    check(body.includes('https://fb.example.com/media/f-0001-1.webp'), '配了 baseUrl → 截图用绝对地址', body.slice(-120))
    check(body.includes('F-0001'), '正文带编号')
    const noBase = issueBody(record('F-0001', { images: ['/media/f-0001-1.webp'] }), githubConfig({ GITHUB_TOKEN: TOKEN }))
    check(!noBase.includes('/media/'), '没配 baseUrl → 不摆点不开的相对地址')
    check(issueTitle(record('F-0031')) === '[F-0031] 伙伴不拾取掉落物', '标题格式 [F-编号] 标题', issueTitle(record('F-0031')))

    /* 4. 从 issue 还原记录（表单正文 / 普通正文） */
    const formIssue = {
      number: 7,
      title: '直接在 GitHub 上提的反馈',
      body: '### 版本\n\n0.3.0\n\n### 内容\n\n学校维度进不去，一进去就黑屏。',
      state: 'open',
      labels: [{ name: '反馈' }],
      html_url: `https://github.com/${REPO}/issues/7`,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    }
    const fromForm = recordFromIssue(formIssue, 'F-0002')
    check(fromForm.version === '0.3.0', '表单正文取「版本」', fromForm.version)
    check(fromForm.content.includes('黑屏'), '表单正文取「内容」', fromForm.content)
    check(fromForm.contact === '', '从 issue 导入不带回访联系方式（issue 是公开渠道）')
    check(recordProblems(fromForm).length === 0, '导入的记录通过结构校验', show(recordProblems(fromForm)))
    const plain = recordFromIssue({ ...formIssue, body: '没有分节的普通正文，直接整篇当内容。' }, 'F-0003')
    check(plain.content === '没有分节的普通正文，直接整篇当内容。', '普通正文整篇当内容')
    check(plain.version === '不确定', '取不到版本时填「不确定」', plain.version)
    let threw = false
    try {
      recordFromIssue({ ...formIssue, title: '' }, 'F-0004')
    } catch {
      threw = true
    }
    check(threw, 'issue 没有标题 → 抛错（由调用方记进 problems）')

    /* 5. 建 issue */
    const store = makeStorage([record('F-0001')])
    const first = await runSync({
      config,
      listRecords: store.list,
      saveRecord: store.save,
      newId: store.nextId,
    })
    check(first.created === 1 && first.problems.length === 0, '首轮同步：给 F-0001 建 issue', show(first))
    check(github.issues.length === 1, '假 GitHub 收到 1 条 issue', String(github.issues.length))
    const created = github.issues[0]
    check(created.title === '[F-0001] 伙伴不拾取掉落物', 'issue 标题带编号前缀', created.title)
    check(
      created.labels.some((label) => label.name === '反馈') && created.labels.some((label) => label.name === '待处理'),
      'issue 带「反馈 + 待处理」标签',
      show(created.labels),
    )
    check(store.records[0].issueUrl === created.html_url, 'issueUrl 写回记录', store.records[0].issueUrl)
    check(/\/issues\/\d+$/.test(store.records[0].issueUrl ?? ''), 'issueUrl 形如 …/issues/N', store.records[0].issueUrl)
    check(
      !JSON.stringify(github.calls).includes('player@example.com'),
      '所有发往 GitHub 的请求里搜不到联系方式',
    )

    /* 6. 幂等 */
    const second = await runSync({ config, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    check(second.created === 0 && second.pushed === 0 && second.pulled === 0, '再跑一轮 → 全部无变化', show(second))
    check(github.issues.length === 1, '不重复建 issue', String(github.issues.length))

    /* 7. 推：服务端改状态 → issue 跟着开关与标签 */
    store.records[0].status = 'fixed'
    // 记录侧必须比 issue 侧「新」才会走推送分支（issue 的时间是假 GitHub 的当前时刻）
    store.records[0].updatedAt = new Date(Date.now() + 60_000).toISOString()
    const pushed = await runSync({ config, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    check(pushed.pushed === 1, '状态更新 → 推送到 issue', show(pushed))
    check(created.state === 'closed', 'fixed → issue 关闭', created.state)
    check(created.labels.some((label) => label.name === '已修复'), 'issue 标签换成「已修复」', show(created.labels))

    /* 8. 回读：在 GitHub 上改状态 → 记录跟着变 */
    created.state = 'open'
    created.labels = [{ name: '反馈' }, { name: '排查中' }]
    created.updated_at = new Date(Date.now() + 60_000).toISOString()
    store.records[0].updatedAt = '2020-01-01T00:00:00.000Z' // 让 issue 侧显得更「新」
    const pulled = await runSync({ config, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    check(pulled.pulled === 1, 'issue 侧更新 → 回读', show(pulled))
    check(store.records[0].status === 'investigating', '回读后记录状态为 investigating', store.records[0].status)

    /* 9. 导入：有人直接在 GitHub 上开了 issue */
    github.issues.push({
      number: 42,
      title: '玩家直接开的 issue',
      body: '### 版本\n\n0.2.0\n\n### 内容\n\n一进学校维度就崩溃，日志链接在下面。',
      state: 'open',
      labels: [{ name: '反馈' }],
      html_url: `https://github.com/${REPO}/issues/42`,
      created_at: '2026-10-02T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    })
    const imported = await runSync({ config, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    check(imported.imported === 1, 'issue 区新建的带标签 issue → 导入记录', show(imported))
    const fresh = store.records.find((item) => item.title === '玩家直接开的 issue')
    check(fresh?.id === 'F-0002', '导入的记录拿到下一个编号', fresh?.id)
    check(fresh?.status === 'pending' && fresh?.version === '0.2.0', '导入记录的状态与版本正确', show(fresh))
    const third = await runSync({ config, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    check(third.imported === 0, '重复跑不再导入同一条 issue', show(third))

    /* 10. 早期记录不镜像 */
    const legacyStore = makeStorage([
      record('F-0030', { legacyUrl: `https://github.com/${REPO}/issues/30`, status: 'investigating' }),
    ])
    const legacySync = await runSync({
      config,
      listRecords: legacyStore.list,
      saveRecord: legacyStore.save,
      newId: legacyStore.nextId,
    })
    check(legacySync.created === 0, '带 legacyUrl 的早期记录不建镜像 issue', show(legacySync))
    check(!legacyStore.records[0].issueUrl, '早期记录不被写入 issueUrl')

    /* 11. 未配置直接报错 */
    let configError = ''
    try {
      await runSync({ config: null, listRecords: store.list, saveRecord: store.save, newId: store.nextId })
    } catch (error) {
      configError = error.message
    }
    check(configError.includes('GITHUB_TOKEN'), '未配置 GITHUB_TOKEN → runSync 抛错', configError)

    /* 12. 鉴权真的在用：换个错 token，同步必须被 GitHub 拒绝 */
    let authError = ''
    try {
      await runSync({
        config: { ...config, token: 'wrong-token' },
        listRecords: store.list,
        saveRecord: store.save,
        newId: store.nextId,
      })
    } catch (error) {
      authError = error.message
    }
    check(authError.includes('401'), 'token 不对 → GitHub 401 冒泡成同步失败', authError || '没报错')
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
