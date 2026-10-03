#!/usr/bin/env node
/**
 * 反馈服务自测（零依赖，不需要网络）。
 *
 *   node service/selftest.mjs
 *
 * 每项都起一个真实的 server 进程、走真实 HTTP，只把数据目录指到临时目录，
 * 因此测的是「玩家真的会撞上的那条路」，而不是把函数单独拎出来调用。
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.join(HERE, 'server.mjs')
const PORT = 8791
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_KEY = 'selftest-admin-key'
const ORIGIN = 'http://localhost:4177'

/** 1×1 的 PNG，够用来验证「收字节 → 存盘 → 取回」这条链路 */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

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

function tempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `shota-feedback-${label}-`))
}

/** 起一个服务进程并等它可用 */
async function startServer(env, label) {
  const dataDir = tempDir(label)
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, SEED_FILE: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (chunk) => {
    log += chunk
  })
  child.stderr.on('data', (chunk) => {
    log += chunk
  })

  const deadline = Date.now() + 10_000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`服务提前退出：\n${log}`)
    try {
      const response = await fetch(`${BASE}/health`)
      if (response.ok) break
    } catch {
      /* 还没起来 */
    }
    if (Date.now() > deadline) throw new Error(`服务未在 10 秒内启动：\n${log}`)
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return { child, dataDir, log: () => log }
}

async function stop(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 3000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function post(pathname, body, headers = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })
  let json = null
  try {
    json = await response.json()
  } catch {
    /* 空响应 */
  }
  return { status: response.status, json }
}

const validSubmission = (extra = {}) => ({
  title: '伙伴不拾取掉落物',
  version: '0.3.1（当前版本）',
  content: '工作状态下不拾取掉落物，站着不动也会一直触发工作动画。',
  ...extra,
})

async function main() {
  /* ============ 常规流程 ============ */
  const { child, dataDir } = await startServer(
    { ADMIN_KEY, RATE_LIMIT_PER_HOUR: '50' },
    'main',
  )

  try {
    const health = await (await fetch(`${BASE}/health`)).json()
    check(health.ok === true && health.service === 'shota-feedback', '/health 正常')
    check(health.records === 0, '空库时 /health.records 为 0', `实际 ${health.records}`)

    /* --- 校验 --- */
    const shortTitle = await post('/submit', validSubmission({ title: '短' }))
    check(shortTitle.status === 400 && !!shortTitle.json?.error, '标题过短 → 400 且带中文提示', JSON.stringify(shortTitle.json))

    const shortContent = await post('/submit', validSubmission({ content: '太短' }))
    check(shortContent.status === 400, '内容过短 → 400', `实际 ${shortContent.status}`)

    const noVersion = await post('/submit', validSubmission({ version: '' }))
    check(noVersion.status === 400, '缺版本 → 400', `实际 ${noVersion.status}`)

    const honeypot = await post('/submit', validSubmission({ honeypot: 'bot' }))
    check(honeypot.status === 400, '蜜罐命中 → 400', `实际 ${honeypot.status}`)

    const badType = await post('/submit', validSubmission({ images: [{ name: 'a.txt', dataUrl: 'data:text/plain;base64,aGk=' }] }))
    check(badType.status === 400, '非图片类型 → 400', `实际 ${badType.status}`)

    const tooMany = await post(
      '/submit',
      validSubmission({
        images: Array.from({ length: 4 }, (_, i) => ({ name: `${i}.png`, dataUrl: `data:image/png;base64,${PNG_BASE64}` })),
      }),
    )
    check(tooMany.status === 400, '图片超过 3 张 → 400', `实际 ${tooMany.status}`)

    const notJson = await fetch(`${BASE}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: '{不是 JSON',
    })
    check(notJson.status === 400, '请求体不是 JSON → 400', `实际 ${notJson.status}`)

    /* --- 成功提交（带图、带联系方式） --- */
    const created = await post(
      '/submit',
      validSubmission({ contact: 'player@example.com', images: [{ name: 'shot.png', dataUrl: `data:image/png;base64,${PNG_BASE64}` }] }),
    )
    check(created.status === 201 && created.json?.ok === true, '合法提交 → 201', `实际 ${created.status}`)
    const record = created.json?.record
    check(record?.id === 'F-0001', '编号从 F-0001 起', `实际 ${record?.id}`)
    check(record?.status === 'pending', '新记录状态为 pending', `实际 ${record?.status}`)
    check(record?.images?.[0] === '/media/f-0001-1.png', '图片地址为 /media/<文件名>', `实际 ${record?.images?.[0]}`)
    check(!('contact' in (record ?? {})), '提交响应不回显联系方式')

    /* --- 列表 --- */
    const list = await (await fetch(`${BASE}/records`)).json()
    check(list.total === 1 && list.records.length === 1, '公开列表返回 1 条', `实际 ${list.total}`)
    check(!('contact' in list.records[0]), '公开列表不含联系方式')
    check(list.records[0].title === '伙伴不拾取掉落物', '列表标题正确')

    const adminList = await (await fetch(`${BASE}/records`, { headers: { 'x-admin-key': ADMIN_KEY } })).json()
    check(adminList.records[0].contact === 'player@example.com', '带管理密钥时列表含联系方式', JSON.stringify(adminList.records[0].contact))

    const wrongKey = await (await fetch(`${BASE}/records`, { headers: { 'x-admin-key': 'wrong' } })).json()
    check(!('contact' in wrongKey.records[0]), '管理密钥不对时不返回联系方式')

    /* --- 图片 --- */
    const imageResponse = await fetch(`${BASE}/media/f-0001-1.png`)
    const bytes = Buffer.from(await imageResponse.arrayBuffer())
    check(imageResponse.status === 200, '取回图片 → 200', `实际 ${imageResponse.status}`)
    check(imageResponse.headers.get('content-type') === 'image/png', '图片 Content-Type 正确', String(imageResponse.headers.get('content-type')))
    check(bytes.toString('base64') === PNG_BASE64, '取回的字节与提交时一致')
    check(
      String(imageResponse.headers.get('cache-control') ?? '').includes('immutable'),
      '图片带长缓存头',
    )
    const missingImage = await fetch(`${BASE}/media/nope.png`)
    check(missingImage.status === 404, '不存在的图片 → 404', `实际 ${missingImage.status}`)
    const traversal = await fetch(`${BASE}/media/..%2Frecords.json`)
    check(traversal.status === 400, '文件名带路径分隔符 → 400', `实际 ${traversal.status}`)

    /* --- 改状态 --- */
    const noKey = await post('/status', { id: 'F-0001', status: 'fixed' })
    check(noKey.status === 403, '无管理密钥改状态 → 403', `实际 ${noKey.status}`)
    const badStatus = await post('/status', { id: 'F-0001', status: '不存在' }, { 'x-admin-key': ADMIN_KEY })
    check(badStatus.status === 400, '非法状态值 → 400', `实际 ${badStatus.status}`)
    const unknown = await post('/status', { id: 'F-0999', status: 'fixed' }, { 'x-admin-key': ADMIN_KEY })
    check(unknown.status === 404, '编号不存在 → 404', `实际 ${unknown.status}`)
    const fixed = await post('/status', { id: 'F-0001', status: 'fixed' }, { 'x-admin-key': ADMIN_KEY })
    check(fixed.status === 200 && fixed.json?.record?.status === 'fixed', '改状态成功', JSON.stringify(fixed.json?.record?.status))
    const afterFix = await (await fetch(`${BASE}/records?status=fixed`)).json()
    check(afterFix.total === 1, '按状态筛选可用', `实际 ${afterFix.total}`)
    const afterOther = await (await fetch(`${BASE}/records?status=pending`)).json()
    check(afterOther.total === 0, '筛选未命中的状态返回空', `实际 ${afterOther.total}`)

    /* --- 落盘 --- */
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'records.json'), 'utf8'))
    check(saved.length === 1 && saved[0].contact === 'player@example.com', '记录（含联系方式）已落盘')
    check(fs.existsSync(path.join(dataDir, 'uploads', 'f-0001-1.png')), '图片已落盘')

    /* --- CORS --- */
    const preflight = await fetch(`${BASE}/submit`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    })
    check(preflight.status === 204, '预检 → 204', `实际 ${preflight.status}`)
    check(preflight.headers.get('access-control-allow-origin') === ORIGIN, '预检回显允许的来源')
    const foreign = await post('/submit', validSubmission(), { origin: 'https://evil.example' })
    check(foreign.status === 403, '来源不在允许列表 → 403', `实际 ${foreign.status}`)

    /* --- 其他 --- */
    const notFound = await fetch(`${BASE}/nope`)
    check(notFound.status === 404, '未知路径 → 404', `实际 ${notFound.status}`)

    const limit = await (await fetch(`${BASE}/records?limit=0`)).json()
    check(limit.records.length === 1, 'limit=0 被夹到 1', `实际 ${limit.records.length}`)

    const badFilter = await fetch(`${BASE}/records?status=不存在的状态`)
    check(badFilter.status === 400, '非法的 status 取值 → 400（不静默忽略）', `实际 ${badFilter.status}`)
    const emptyFilter = await (await fetch(`${BASE}/records?status=`)).json()
    check(emptyFilter.total === 1, 'status 为空串时不做筛选', `实际 ${emptyFilter.total}`)
  } finally {
    await stop(child)
    fs.rmSync(dataDir, { recursive: true, force: true })
  }

  /* ============ 维护者导入（补档 / 迁移） ============ */
  {
    const { child, dataDir } = await startServer({ ADMIN_KEY, RATE_LIMIT_PER_HOUR: '50' }, 'import')
    try {
      const legacy = [
        {
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
        },
      ]
      const noKey = await post('/import', { records: legacy })
      check(noKey.status === 403, '导入不带密钥 → 403', `实际 ${noKey.status}`)

      const first = await post('/import', { records: legacy }, { 'x-admin-key': ADMIN_KEY })
      check(first.json?.imported === 1 && first.json?.skipped === 0, '导入 1 条成功', JSON.stringify(first.json))

      const again = await post('/import', { records: legacy }, { 'x-admin-key': ADMIN_KEY })
      check(again.json?.imported === 0 && again.json?.skipped === 1, '重复导入按编号幂等', JSON.stringify(again.json))

      const allBad = await post('/import', { records: [{ id: 'X', title: '' }] }, { 'x-admin-key': ADMIN_KEY })
      check(allBad.status === 400, '整批都不合法 → 400', `实际 ${allBad.status}`)

      const mixed = await post(
        '/import',
        {
          records: [
            {
              id: 'F-0102',
              title: '半批记录',
              version: '0.2.0',
              content: '只有这一条是合法的：混在坏记录里也应当被导入。',
              images: [],
              status: 'pending',
              createdAt: '2026-01-02T03:04:05.000Z',
            },
            { id: 'nope' },
          ],
        },
        { 'x-admin-key': ADMIN_KEY },
      )
      check(
        mixed.json?.imported === 1 && mixed.json?.problems?.length === 1,
        '坏记录被挑出、好记录照常导入',
        JSON.stringify(mixed.json),
      )

      const listed = await (await fetch(`${BASE}/records?limit=200`)).json()
      const kept = listed.records.find((record) => record.id === 'F-0101')
      check(
        kept?.status === 'fixed' && kept?.legacyUrl === 'https://example.com/legacy/101' && !('contact' in kept),
        '导入保留状态与原链接，公开列表不带联系方式',
        JSON.stringify(kept),
      )
      const adminView = await (await fetch(`${BASE}/records?limit=200`, { headers: { 'x-admin-key': ADMIN_KEY } })).json()
      check(
        adminView.records.find((record) => record.id === 'F-0101')?.contact === 'keepme@example.com',
        '导入保留联系方式（维护者可见）',
        '联系方式丢了',
      )

      // 编号接着已有最大值往下发，不会与导入的历史记录撞号
      const next = await post('/submit', validSubmission())
      check(next.json?.record?.id === 'F-0103', '新记录编号接在导入记录之后', `实际 ${next.json?.record?.id}`)
    } finally {
      await stop(child)
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
  }

  /* ============ 限流 ============ */
  {
    const { child, dataDir } = await startServer({ RATE_LIMIT_PER_HOUR: '1' }, 'rate')
    try {
      const first = await post('/submit', validSubmission())
      const second = await post('/submit', validSubmission({ title: '第二条反馈' }))
      check(first.status === 201, '限流下第一条正常', `实际 ${first.status}`)
      check(second.status === 429, '超出限额 → 429', `实际 ${second.status}`)
      check(
        (await post('/submit', validSubmission({ title: '短' }))).status === 400,
        '被拦下的请求不消耗配额（校验失败仍是 400 而不是 429）',
      )
    } finally {
      await stop(child)
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
  }

  /* ============ DRY_RUN ============ */
  {
    const { child, dataDir } = await startServer({ DRY_RUN: '1' }, 'dry')
    try {
      const result = await post('/submit', validSubmission())
      check(result.status === 200 && result.json?.dryRun === true, 'DRY_RUN 下提交只回显', JSON.stringify(result.json?.dryRun))
      check(!fs.existsSync(path.join(dataDir, 'records.json')), 'DRY_RUN 下不落盘')
    } finally {
      await stop(child)
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
  }

  /* ============ 首次启动导入种子 ============ */
  {
    const seedDir = tempDir('seed')
    const seedFile = path.join(seedDir, 'seed.json')
    fs.writeFileSync(
      seedFile,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        records: [
          {
            id: 'F-0030',
            title: '历史记录：加载界面按键即崩溃',
            version: '0.3.1',
            content: '早期从 issue 导入的记录，用来验证种子导入这条路。',
            images: ['https://github.com/user-attachments/assets/example'],
            status: 'investigating',
            createdAt: '2026-10-02T14:39:03Z',
            updatedAt: '2026-10-02T14:39:03Z',
            legacyUrl: 'https://github.com/Paltrow-Studio/ShotaPartner-Docs/issues/30',
          },
        ],
      }),
      'utf8',
    )
    const { child, dataDir } = await startServer({ SEED_FILE: seedFile }, 'seedrun')
    try {
      const health = await (await fetch(`${BASE}/health`)).json()
      check(health.records === 1, '首次启动导入种子记录', `实际 ${health.records}`)
      const list = await (await fetch(`${BASE}/records`)).json()
      check(list.records[0].id === 'F-0030' && list.records[0].status === 'investigating', '种子记录连同状态一起导入')
      const created = await post('/submit', validSubmission())
      check(created.json?.record?.id === 'F-0031', '新记录序号接在种子之后', `实际 ${created.json?.record?.id}`)
    } finally {
      await stop(child)
      fs.rmSync(dataDir, { recursive: true, force: true })
      fs.rmSync(seedDir, { recursive: true, force: true })
    }
  }

  console.log('')
  console.log(`通过 ${passed} / ${passed + failed}`)
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error(`自测中断：${error.message}`)
  process.exit(1)
})