#!/usr/bin/env node
/**
 * 反馈服务 Worker 自测。
 *
 * 直接 `node service/worker.selftest.mjs` 就能跑：不需要 wrangler、不需要网络，
 * 也不碰任何真实存储——用一个手写的假 KV（Map 实现）冒充 Cloudflare 的 RECORDS 绑定，
 * 然后像边缘节点那样调 `worker.fetch(new Request(...), env)`。
 *
 * 为什么不用真 KV：自测要能在任何一台机器上跑，而真 KV 需要账号、部署与网络；
 * 假 KV 反而能把「最终一致性」「无原子自增」这些边界用注释标出来。
 * 假 KV 只保证单线程顺序调用下的正确性（TTL 直接忽略、不做过期），
 * 所以它验证的是接口行为，不是并发语义。
 *
 * 覆盖：健康检查、提交、媒体回读、联系方式不外泄、各类校验失败、蜜罐、
 * 筛选与分页、管理改状态、限流、来源白名单与预检、DRY_RUN、404/500。
 */

import worker from './worker.js'
import { recordProblems } from './store.mjs'

/* ---------- 断言与输出 ---------- */

let passed = 0
let failed = 0

function check(ok, label, detail = '') {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}（${detail}）`)
  }
}

/** 失败时把实际值打印出来，但别让一行日志爆炸。 */
function show(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return String(text ?? value).slice(0, 200)
  } catch {
    return String(value)
  }
}

/* ---------- 假 KV ---------- */

class FakeKV {
  /** seed：直接放进存储的键值，用来摆出「已经有一批记录」的场景。 */
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed))
  }

  async get(key, options) {
    const value = this.map.get(key)
    if (value === undefined) return null
    const type = typeof options === 'string' ? options : options?.type ?? 'text'
    if (type === 'arrayBuffer') {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
    if (type === 'json') return JSON.parse(value)
    return typeof value === 'string' ? value : new TextDecoder().decode(value)
  }

  async put(key, value) {
    // 真 KV 有 expirationTtl / metadata，这里只关心值本身：自测不跨小时窗口，
    // 限流计数会不会过期不影响结论。
    this.map.set(key, value instanceof ArrayBuffer ? new Uint8Array(value) : value)
  }

  async delete(key) {
    this.map.delete(key)
  }

  /** 与真 KV 一致：按键名字典序返回，单页有上限，翻页靠 cursor。 */
  async list(options = {}) {
    const prefix = options.prefix ?? ''
    const limit = options.limit ?? 1000
    const names = [...this.map.keys()].filter((name) => name.startsWith(prefix)).sort()
    const start = options.cursor ? Number(options.cursor) : 0
    const page = names.slice(start, start + limit)
    const next = start + page.length
    return {
      keys: page.map((name) => ({ name })),
      list_complete: next >= names.length,
      ...(next < names.length ? { cursor: String(next) } : {}),
    }
  }
}

/**
 * 前若干次 list 故意返回「滞后」的结果（看不到已经存在的键），
 * 用来复现 KV 最终一致造成的编号撞车：get 能看到记录，list 却还没列出来。
 */
class StaleListKV extends FakeKV {
  constructor(seed, staleCalls) {
    super(seed)
    this.staleCalls = staleCalls
  }

  async list(options) {
    if (this.staleCalls > 0) {
      this.staleCalls -= 1
      return { keys: [], list_complete: true }
    }
    return super.list(options)
  }
}

/* ---------- 夹具 ---------- */

const ORIGIN = 'https://site.example'
const ADMIN_KEY = 'test-admin-key'
/** 最小的「PNG 头」，内容不重要：服务端只做 base64 解码与类型判断，不解码图片。 */
const IMAGE_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5])
const IMAGE_DATA_URL = `data:image/png;base64,${Buffer.from(IMAGE_BYTES).toString('base64')}`

function makeEnv(overrides = {}) {
  return {
    RECORDS: new FakeKV(),
    ALLOWED_ORIGINS: ORIGIN,
    ADMIN_KEY,
    RATE_LIMIT_PER_HOUR: '5',
    ...overrides,
  }
}

function submission(overrides = {}) {
  return {
    title: '伙伴不拾取掉落物',
    version: '0.3.1（当前版本）',
    content: '工作状态下不拾取掉落物，站着不动也会一直触发工作动画。',
    contact: 'player@example.com',
    images: [{ name: 'shot.png', type: 'image/png', dataUrl: IMAGE_DATA_URL }],
    honeypot: '',
    ...overrides,
  }
}

function fixture(id, status, createdAt) {
  return {
    id,
    title: `标题 ${id}`,
    version: '0.3.1（当前版本）',
    content: '这是一段足够长的内容，用来满足内容长度下限。',
    contact: 'hidden@example.com',
    status,
    images: [],
    createdAt,
    updatedAt: createdAt,
  }
}

function request(path, { method = 'GET', body, origin = ORIGIN, headers = {} } = {}) {
  const all = new Headers(headers)
  // origin: null 表示「不带 Origin」，模拟 curl 与同源请求（两者都不该被白名单挡）。
  if (origin) all.set('Origin', origin)
  if (body !== undefined && !all.has('content-type')) all.set('Content-Type', 'application/json')
  return new Request(`https://feedback.test${path}`, {
    method,
    headers: all,
    ...(body !== undefined ? { body } : {}),
  })
}

const get = (env, path, options) => worker.fetch(request(path, options), env)
const post = (env, path, payload, options = {}) =>
  worker.fetch(request(path, { ...options, method: 'POST', body: JSON.stringify(payload) }), env)

/* ---------- 各项自测 ---------- */

async function main() {
  /* 1. /health */
  const env = makeEnv()
  const healthRes = await get(env, '/health')
  const health = await healthRes.json()
  check(
    healthRes.status === 200 && health.ok === true && health.service === 'shota-feedback' && health.version === 1,
    'GET /health 返回 200 与服务标识',
    `实际 ${healthRes.status} ${show(health)}`,
  )
  check(health.records === 0, 'GET /health 的 records 初始为 0', `实际 ${show(health.records)}`)
  check(
    healthRes.headers.get('cache-control') === 'no-store' &&
      (healthRes.headers.get('content-type') ?? '').includes('application/json'),
    'JSON 响应带 no-store 与 JSON Content-Type',
    `cache-control=${healthRes.headers.get('cache-control')} content-type=${healthRes.headers.get('content-type')}`,
  )

  /* 2. 提交成功 */
  const submitRes = await post(env, '/submit', submission())
  const submitBody = await submitRes.json()
  const record = submitBody.record
  check(
    submitRes.status === 201 && submitBody.ok === true && record,
    'POST /submit 成功返回 201 与 record',
    `实际 ${submitRes.status} ${show(submitBody)}`,
  )
  check(record?.id === 'F-0001' && /^F-\d{4}$/.test(record.id), '编号形如 F-0001', `实际 ${show(record?.id)}`)
  check(record?.status === 'pending', '新记录状态为 pending', `实际 ${show(record?.status)}`)
  check(
    Array.isArray(record?.images) && record.images.length === 1 && record.images[0].startsWith('/media/'),
    '图片地址是 /media/…',
    `实际 ${show(record?.images)}`,
  )
  check(
    recordProblems(record).length === 0,
    '记录结构通过 store.mjs 的 recordProblems 校验',
    `问题 ${show(recordProblems(record))}`,
  )
  const recordsAfterSubmit = await (await get(env, '/health')).json()
  check(recordsAfterSubmit.records === 1, '/health 的 records 计入新记录', `实际 ${show(recordsAfterSubmit.records)}`)

  /* 3. 图片回读 */
  const mediaName = record.images[0].slice('/media/'.length)
  const mediaRes = await get(env, `/media/${mediaName}`)
  const mediaBytes = new Uint8Array(await mediaRes.arrayBuffer())
  check(mediaRes.status === 200, `GET /media/${mediaName} 返回 200`, `实际 ${mediaRes.status}`)
  check(
    mediaRes.headers.get('content-type') === 'image/png',
    'media 的 Content-Type 是提交时的类型',
    `实际 ${mediaRes.headers.get('content-type')}`,
  )
  check(
    mediaRes.headers.get('cache-control') === 'public, max-age=31536000, immutable',
    'media 带 immutable 长缓存',
    `实际 ${mediaRes.headers.get('cache-control')}`,
  )
  check(
    mediaBytes.length === IMAGE_BYTES.length && mediaBytes.every((byte, index) => byte === IMAGE_BYTES[index]),
    'media 字节与提交时完全一致',
    `实际 ${show([...mediaBytes])}`,
  )

  /* 4. 公开列表不含 contact */
  const listRes = await get(env, '/records')
  const list = await listRes.json()
  check(
    listRes.status === 200 && list.records.length === 1 && list.records.every((item) => !('contact' in item)),
    'GET /records 的每条记录都不含 contact',
    `实际 ${show(list)}`,
  )
  check(
    !JSON.stringify(list).includes('player@example.com'),
    'GET /records 响应文本里搜不到联系方式原值',
    show(list),
  )
  const adminListRes = await get(env, '/records', { headers: { 'x-admin-key': ADMIN_KEY } })
  const adminList = await adminListRes.json()
  check(
    adminList.records.length === 1 && adminList.records[0].contact === 'player@example.com',
    'GET /records 带对 X-Admin-Key 时附上 contact（维护者回访用）',
    `实际 ${show(adminList.records[0])}`,
  )
  const noKeyList = await (await get(env, '/records', { headers: { 'x-admin-key': 'not-the-key' } })).json()
  check(
    !('contact' in noKeyList.records[0]),
    'GET /records 密钥不对时不附 contact',
    `实际 ${show(noKeyList.records[0])}`,
  )
  const unsetKeyList = await (
    await get({ ...env, ADMIN_KEY: '' }, '/records', { headers: { 'x-admin-key': '' } })
  ).json()
  check(
    !('contact' in unsetKeyList.records[0]),
    '未配置 ADMIN_KEY 时任何人都拿不到 contact',
    `实际 ${show(unsetKeyList.records[0])}`,
  )
  const stored = JSON.parse(await env.RECORDS.get(`record:${record.id}`))
  check(
    stored.contact === 'player@example.com',
    'contact 仍然写进存储（维护者可见）',
    `实际 ${show(stored.contact)}`,
  )

  /* 5. 校验失败：400 且错误信息非空 */
  const cases = [
    ['标题过短', { title: '短' }, '标题'],
    ['内容过短', { content: '太短' }, '内容'],
    [
      '图片类型不支持',
      { images: [{ name: 'a.svg', type: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }] },
      '图片类型',
    ],
    [
      '图片过多',
      {
        images: Array.from({ length: 4 }, (_, index) => ({
          name: `shot-${index}.png`,
          type: 'image/png',
          dataUrl: IMAGE_DATA_URL,
        })),
      },
      '图片数量',
    ],
  ]
  for (const [label, overrides, hint] of cases) {
    const res = await post(env, '/submit', submission(overrides))
    let body = null
    try {
      body = await res.json()
    } catch {
      /* 非 JSON 时下面自然会失败 */
    }
    check(
      res.status === 400 && typeof body?.error === 'string' && body.error.length > 0 && body.ok === false,
      `${hint}不合法 → 400 且带中文说明`,
      `实际 ${res.status} ${show(body)}`,
    )
  }

  /* 6. 蜜罐 */
  const honeyRes = await post(env, '/submit', submission({ honeypot: 'bot' }))
  const honey = await honeyRes.json()
  check(
    honeyRes.status === 400 && typeof honey.error === 'string' && honey.error.length > 0,
    '蜜罐命中 → 400 且带说明',
    `实际 ${honeyRes.status} ${show(honey)}`,
  )
  check(
    (await (await get(env, '/health')).json()).records === 1,
    '被拒的提交没有写进存储',
    '实际记录数不是 1',
  )

  /* 7. status 筛选与 limit */
  const seededEnv = makeEnv({
    RECORDS: new FakeKV({
      'record:F-0001': JSON.stringify(fixture('F-0001', 'pending', '2026-10-03T04:00:00.000Z')),
      'record:F-0002': JSON.stringify(fixture('F-0002', 'fixed', '2026-10-03T05:00:00.000Z')),
      'record:F-0003': JSON.stringify(fixture('F-0003', 'fixed', '2026-10-03T06:00:00.000Z')),
    }),
  })
  const fixedOnly = await (await get(seededEnv, '/records?status=fixed')).json()
  check(
    fixedOnly.records.length === 2 && fixedOnly.records.every((item) => item.status === 'fixed'),
    '?status=fixed 只返回该状态的记录',
    `实际 ${show(fixedOnly.records.map((item) => item.id))}`,
  )
  const limited = await (await get(seededEnv, '/records?limit=2')).json()
  check(limited.records.length === 2, '?limit=2 生效', `实际 ${limited.records.length} 条`)
  check(
    limited.records[0]?.id === 'F-0003' && limited.records[1]?.id === 'F-0002',
    '记录按 createdAt 倒序',
    `实际 ${show(limited.records.map((item) => item.id))}`,
  )
  const all = await (await get(seededEnv, '/records')).json()
  check(all.records.length === 3 && all.total === 3, '不带参数返回全部记录', `实际 ${show(all.total)}`)
  const badStatusRes = await get(seededEnv, '/records?status=bogus')
  const badStatus = await badStatusRes.json()
  check(
    badStatusRes.status === 400 && typeof badStatus.error === 'string' && badStatus.error.length > 0,
    '非法的 status 取值 → 400 且带说明（与 server.mjs 行为一致）',
    `实际 ${badStatusRes.status} ${show(badStatus.error)}`,
  )
  const emptyStatus = await (await get(seededEnv, '/records?status=')).json()
  check(emptyStatus.total === 3, 'status 为空串时不做筛选', `实际 ${show(emptyStatus.total)}`)
  const clamped = await (await get(seededEnv, '/records?limit=1000&status=fixed')).json()
  check(clamped.records.length === 2, 'limit 超出范围时收拢到 200（仍返回全部 2 条）', `实际 ${clamped.records.length}`)

  /* 8. POST /import（补档 / 迁移） */
  const noKeyImport = await post(seededEnv, '/import', { records: [] })
  check(noKeyImport.status === 403, '导入不带密钥 → 403', `实际 ${noKeyImport.status}`)
  const legacyRecord = {
    id: 'F-0101',
    title: '导入的历史记录',
    version: '0.2.0',
    content: '这条来自补档，用来验证导入接口。',
    images: ['https://example.com/a.png'],
    status: 'fixed',
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    contact: 'keepme@example.com',
    legacyUrl: 'https://example.com/legacy/101',
  }
  const imported = await (await post(seededEnv, '/import', { records: [legacyRecord] }, { headers: { 'x-admin-key': ADMIN_KEY } })).json()
  check(imported.imported === 1 && imported.skipped === 0, '导入 1 条成功', JSON.stringify(imported))
  const importedAgain = await (await post(seededEnv, '/import', { records: [legacyRecord] }, { headers: { 'x-admin-key': ADMIN_KEY } })).json()
  check(importedAgain.imported === 0 && importedAgain.skipped === 1, '重复导入按编号幂等', JSON.stringify(importedAgain))
  const allBadImport = await post(seededEnv, '/import', { records: [{ id: 'X' }] }, { headers: { 'x-admin-key': ADMIN_KEY } })
  check(allBadImport.status === 400, '整批都不合法 → 400', `实际 ${allBadImport.status}`)
  const listedAfterImport = await (await get(seededEnv, '/records?limit=200')).json()
  const keptRecord = listedAfterImport.records.find((record) => record.id === 'F-0101')
  check(
    keptRecord?.status === 'fixed' && keptRecord?.legacyUrl === 'https://example.com/legacy/101' && !('contact' in keptRecord),
    '导入保留状态与原链接，公开列表不带联系方式',
    JSON.stringify(keptRecord),
  )
  /* 9. POST /status */
  const noKeyRes = await post(env, '/status', { id: record.id, status: 'fixed' })
  check(noKeyRes.status === 403, 'POST /status 无密钥 → 403', `实际 ${noKeyRes.status}`)
  const wrongKeyRes = await post(env, '/status', { id: record.id, status: 'fixed' }, {
    headers: { 'x-admin-key': 'not-the-key' },
  })
  check(wrongKeyRes.status === 403, 'POST /status 密钥错误 → 403', `实际 ${wrongKeyRes.status}`)
  const okKeyRes = await post(env, '/status', { id: record.id, status: 'fixed' }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  const okKeyBody = await okKeyRes.json()
  check(
    okKeyRes.status === 200 && okKeyBody.record?.status === 'fixed',
    'POST /status 密钥正确 → 200 且状态已改',
    `实际 ${okKeyRes.status} ${show(okKeyBody)}`,
  )
  const persisted = await (await get(env, '/records?status=fixed')).json()
  check(
    persisted.records.length === 1 && persisted.records[0].id === record.id,
    '改状态已落盘（筛选能查到）',
    `实际 ${show(persisted.records)}`,
  )
  const missingIdRes = await post(env, '/status', { id: 'F-9999', status: 'fixed' }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  check(missingIdRes.status === 404, 'POST /status 编号不存在 → 404', `实际 ${missingIdRes.status}`)
  const badStatusBody = await post(env, '/status', { id: record.id, status: 'nope' }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  check(badStatusBody.status === 400, 'POST /status 状态取值非法 → 400', `实际 ${badStatusBody.status}`)

  /* 9b. POST /sync（未配 GITHUB_TOKEN：只验证鉴权与开关） */
  const syncNoKeyRes = await post(env, '/sync', {})
  check(syncNoKeyRes.status === 403, 'POST /sync 无密钥 → 403', `实际 ${syncNoKeyRes.status}`)
  const syncNoConfigRes = await post(env, '/sync', {}, { headers: { 'x-admin-key': ADMIN_KEY } })
  const syncNoConfigBody = await syncNoConfigRes.json()
  check(
    syncNoConfigRes.status === 400 && /GITHUB_TOKEN/.test(syncNoConfigBody?.error ?? ''),
    'POST /sync 未配置 GITHUB_TOKEN → 400 且说明原因',
    `实际 ${syncNoConfigRes.status} ${show(syncNoConfigBody)}`,
  )

  /* 9c. POST /link（issue 链接写回） */
  const ISSUE_URL = 'https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/31'
  const linkNoKeyRes = await post(env, '/link', { id: record.id, issueUrl: ISSUE_URL })
  check(linkNoKeyRes.status === 403, 'POST /link 无密钥 → 403', `实际 ${linkNoKeyRes.status}`)
  const linkBadRes = await post(env, '/link', { id: record.id, issueUrl: 'javascript:alert(1)' }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  check(linkBadRes.status === 400, 'POST /link 链接不合法 → 400', `实际 ${linkBadRes.status}`)
  const linkMissingRes = await post(env, '/link', { id: 'F-9999', issueUrl: ISSUE_URL }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  check(linkMissingRes.status === 404, 'POST /link 编号不存在 → 404', `实际 ${linkMissingRes.status}`)
  const beforeLinkStatus = JSON.parse(await env.RECORDS.get(`record:${record.id}`))
  const linkOkRes = await post(env, '/link', { id: record.id, issueUrl: ISSUE_URL }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  const linkOkBody = await linkOkRes.json()
  check(
    linkOkRes.status === 200 && linkOkBody.record?.issueUrl === ISSUE_URL,
    'POST /link 写回成功且公开响应带 issueUrl',
    `实际 ${linkOkRes.status} ${show(linkOkBody)}`,
  )
  const afterLinkRecord = JSON.parse(await env.RECORDS.get(`record:${record.id}`))
  check(
    afterLinkRecord.issueUrl === ISSUE_URL &&
      afterLinkRecord.updatedAt === beforeLinkStatus.updatedAt &&
      afterLinkRecord.status === beforeLinkStatus.status,
    '/link 已落盘且不改 updatedAt 与 status',
    show({ updatedAt: [beforeLinkStatus.updatedAt, afterLinkRecord.updatedAt] }),
  )

  /* 10. 限流：校验不消耗配额，超限 429 */
  const rateEnv = makeEnv({ RATE_LIMIT_PER_HOUR: '1' })
  const invalidFirst = await post(rateEnv, '/submit', submission({ title: '短' }))
  check(invalidFirst.status === 400, '限流环境：校验失败的提交仍是 400', `实际 ${invalidFirst.status}`)
  const firstOk = await post(rateEnv, '/submit', submission())
  check(firstOk.status === 201, '限流环境：配额内第一条 → 201（说明上一条没消耗配额）', `实际 ${firstOk.status}`)
  const secondRes = await post(rateEnv, '/submit', submission())
  const secondBody = await secondRes.json()
  check(
    secondRes.status === 429 && typeof secondBody.error === 'string' && secondBody.error.length > 0,
    '超出配额 → 429 且带说明',
    `实际 ${secondRes.status} ${show(secondBody)}`,
  )
  check(
    (await (await get(rateEnv, '/health')).json()).records === 1,
    '被限流的提交没有写进存储',
    '实际记录数不是 1',
  )

  /* 11. 来源白名单与预检 */
  const evilRes = await post(env, '/submit', submission(), { origin: 'https://evil.example' })
  check(evilRes.status === 403, '非法 Origin 的提交 → 403', `实际 ${evilRes.status}`)
  const evilReadRes = await get(env, '/records', { origin: 'https://evil.example' })
  check(evilReadRes.status === 403, '非法 Origin 读取 /records → 403', `实际 ${evilReadRes.status}`)
  const preflightRes = await get(env, '/submit', { method: 'OPTIONS' })
  const allowHeaders = preflightRes.headers.get('access-control-allow-headers') ?? ''
  check(
    preflightRes.status === 204 &&
      preflightRes.headers.get('access-control-allow-origin') === ORIGIN &&
      (preflightRes.headers.get('access-control-allow-methods') ?? '').includes('POST') &&
      allowHeaders.includes('content-type') &&
      allowHeaders.includes('x-admin-key') &&
      preflightRes.headers.get('vary') === 'Origin',
    '合法 Origin 的 OPTIONS 预检 → 204 且带完整 CORS 头',
    `实际 ${preflightRes.status} ACAO=${preflightRes.headers.get('access-control-allow-origin')} allow-headers=${allowHeaders}`,
  )
  const noOriginRes = await get(env, '/health', { origin: null })
  check(noOriginRes.status === 200, '不带 Origin（curl / 同源）不受白名单影响', `实际 ${noOriginRes.status}`)

  /* 11. DRY_RUN */
  const dryEnv = makeEnv({ DRY_RUN: '1' })
  const dryRes = await post(dryEnv, '/submit', submission())
  const dry = await dryRes.json()
  check(
    dryRes.status === 200 && dry.ok === true && dry.dryRun === true && dry.wouldCreate && typeof dry.wouldCreate === 'object',
    'DRY_RUN=1 的提交 → 200 且回显 wouldCreate',
    `实际 ${dryRes.status} ${show(dry)}`,
  )
  check(
    dry.wouldCreate?.id === 'F-0001' && dry.wouldCreate?.status === 'pending',
    'wouldCreate 是「将会写入的记录」（含将分配的编号与 pending 状态）',
    `实际 ${show(dry.wouldCreate)}`,
  )
  check(
    Array.isArray(dry.wouldCreate?.images) && dry.wouldCreate.images.length === 1 && dry.wouldCreate.images[0] === 'shot.png',
    'wouldCreate.images 是客户端给的文件名（与 server.mjs 一致）',
    `实际 ${show(dry.wouldCreate?.images)}`,
  )
  check(
    (await (await get(dryEnv, '/health')).json()).dryRun === true,
    'GET /health 会报 dryRun（部署方一眼看出没在真正收件）',
    '实际 dryRun 字段不为 true',
  )
  check(
    (await (await get(dryEnv, '/health')).json()).records === 0,
    'DRY_RUN 不写 KV（记录数仍为 0）',
    '实际记录数不为 0',
  )
  check(
    dryEnv.RECORDS.map.size === 0,
    'DRY_RUN 对 KV 零写入（一个键都没有，含限流计数）',
    `实际存在 ${dryEnv.RECORDS.map.size} 个键：${show([...dryEnv.RECORDS.map.keys()])}`,
  )
  const dryStatusEnv = makeEnv({
    DRY_RUN: '1',
    RECORDS: new FakeKV({
      'record:F-0001': JSON.stringify(fixture('F-0001', 'pending', '2026-10-03T04:00:00.000Z')),
    }),
  })
  const dryStatusRes = await post(dryStatusEnv, '/status', { id: 'F-0001', status: 'fixed' }, {
    headers: { 'x-admin-key': ADMIN_KEY },
  })
  const dryStatusBody = await dryStatusRes.json()
  check(
    dryStatusRes.status === 200 && dryStatusBody.record?.status === 'fixed',
    'DRY_RUN 下的 POST /status 回显改动',
    `实际 ${dryStatusRes.status} ${show(dryStatusBody)}`,
  )
  check(
    JSON.parse(await dryStatusEnv.RECORDS.get('record:F-0001')).status === 'pending',
    'DRY_RUN 下的 POST /status 不落盘（存储里仍是 pending）',
    `实际 ${show(JSON.parse(await dryStatusEnv.RECORDS.get('record:F-0001')).status)}`,
  )
  const dryNoKvEnv = { ALLOWED_ORIGINS: ORIGIN, DRY_RUN: '1' }
  const dryNoKvRes = await post(dryNoKvEnv, '/submit', submission())
  const dryNoKv = await dryNoKvRes.json()
  check(
    dryNoKvRes.status === 200 && typeof dryNoKv.wouldCreate === 'object' && dryNoKv.wouldCreate?.id === undefined,
    'DRY_RUN 演练不要求 KV 绑定（没有绑定时省掉编号）',
    `实际 ${dryNoKvRes.status} ${show(dryNoKv)}`,
  )

  /* 12. 编号撞车：list 滞后时的重试 */
  const staleEnv = makeEnv({
    RECORDS: new StaleListKV({ 'record:F-0001': JSON.stringify(fixture('F-0001', 'pending', '2026-10-03T04:00:00.000Z')) }, 1),
  })
  const staleRes = await post(staleEnv, '/submit', submission())
  const staleBody = await staleRes.json()
  check(
    staleRes.status === 201 && staleBody.record?.id === 'F-0002',
    'KV list 滞后算出已占用的编号 → 重新 list 后改用 F-0002',
    `实际 ${staleRes.status} ${show(staleBody.record?.id ?? staleBody)}`,
  )
  const stuckEnv = makeEnv({
    RECORDS: new StaleListKV({ 'record:F-0001': JSON.stringify(fixture('F-0001', 'pending', '2026-10-03T04:00:00.000Z')) }, 99),
  })
  const stuckRes = await post(stuckEnv, '/submit', submission())
  check(stuckRes.status === 500, 'list 一直滞后、重试耗尽 → 500（宁可失败也不覆盖）', `实际 ${stuckRes.status}`)

  /* 13. 边界：404 / 413 / 500 */
  const missingMediaRes = await get(env, '/media/f-0001-9.png')
  check(missingMediaRes.status === 404, '不存在的图片 → 404', `实际 ${missingMediaRes.status}`)
  const badNameRes = await get(env, '/media/..%2Fsecret.png')
  check(badNameRes.status === 404, '文件名含路径分隔符 → 404', `实际 ${badNameRes.status}`)
  const unknownRouteRes = await get(env, '/nope')
  check(unknownRouteRes.status === 404, '未知路由 → 404', `实际 ${unknownRouteRes.status}`)
  const tooLargeRes = await worker.fetch(
    request('/submit', {
      method: 'POST',
      body: JSON.stringify(submission()),
      headers: { 'content-length': String(32 * 1024 * 1024) },
    }),
    env,
  )
  check(tooLargeRes.status === 413, '声明超大 Content-Length → 413', `实际 ${tooLargeRes.status}`)
  const noBindingRes = await get({ ALLOWED_ORIGINS: ORIGIN }, '/health')
  check(noBindingRes.status === 500, '未绑定 RECORDS → 500', `实际 ${noBindingRes.status}`)
}

main()
  .then(() => {
    const total = passed + failed
    console.log('')
    console.log(`通过 ${passed} / ${total}`)
    if (failed > 0) process.exit(1)
  })
  .catch((error) => {
    const total = passed + failed + 1
    console.log(`✗ 自测中断（${error?.stack ?? error}）`)
    console.log('')
    console.log(`通过 ${passed} / ${total}`)
    process.exit(1)
  })