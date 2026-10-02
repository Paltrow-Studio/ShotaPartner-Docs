#!/usr/bin/env node
/**
 * 反馈服务（Node 18+，零依赖）。
 *
 * 玩家在 feedback.html 上填标题 / 版本 / 内容、可选附截图，服务把记录存在
 * DATA_DIR 下：records.json 存记录，uploads/ 存图片。没有 GitHub、没有数据库、
 * 没有第三方表单，一个进程就是全部依赖。
 *
 * 接口见 service/CONTRACT.md；字段与上限的唯一来源是 service/store.mjs。
 *
 * 启动：node service/server.mjs
 * 演练：DRY_RUN=1 node service/server.mjs      （只校验并回显，不落盘）
 * 自测：node service/selftest.mjs              （自动起停本服务）
 *
 * 环境变量：
 *   PORT                  默认 8787
 *   DATA_DIR              默认 service/data
 *   SEED_FILE             首次启动、库为空时导入的种子记录；默认 ../public/records.json
 *   ADMIN_KEY             设置后才允许 POST /status 改状态
 *   ALLOWED_ORIGINS       逗号分隔；默认站点域名 + 本地预览/开发端口
 *   RATE_LIMIT_PER_HOUR   单 IP 每小时提交上限，默认 5
 *   DRY_RUN=1             不写盘
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  LIMITS,
  buildRecord,
  isStatus,
  publicRecord,
  recordId,
  recordProblems,
  sequenceOf,
  validateSubmission,
} from './store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8787)
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(HERE, 'data'))
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const RECORDS_FILE = path.join(DATA_DIR, 'records.json')
const SEED_FILE = path.resolve(process.env.SEED_FILE ?? path.join(HERE, '..', 'public', 'records.json'))
const ADMIN_KEY = process.env.ADMIN_KEY ?? ''
const DRY_RUN = process.env.DRY_RUN === '1'
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 5)
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  [
    'https://paltrow-studio.github.io',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4177',
    'http://127.0.0.1:4177',
    'http://localhost:4178',
    'http://127.0.0.1:4178',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * 请求体上限。截图以 base64 承载，比原始字节大约 1/3；
 * 契约里图片合计上限 8 MB，这里留出 JSON 与转义的余量。
 */
const MAX_BODY_BYTES = Math.ceil(LIMITS.mediaBytesMax * 1.5) + 512 * 1024

const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
const TYPE_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

/* ---------- 存储 ---------- */

/** 内存里的记录表；写盘用「临时文件 + rename」，避免写到一半断电留下半截 JSON。 */
let records = []
/** 串行化写盘，避免并发提交互相覆盖 */
let writeChain = Promise.resolve()

function loadRecords() {
  if (!fs.existsSync(RECORDS_FILE)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'))
    if (!Array.isArray(parsed)) throw new Error('顶层不是数组')
    const bad = parsed.flatMap((record) => recordProblems(record).map((p) => `${record?.id}: ${p}`))
    if (bad.length) {
      console.warn(`反馈服务：${RECORDS_FILE} 里有 ${bad.length} 处问题，已忽略这些问题记录`)
      for (const line of bad.slice(0, 5)) console.warn(`  · ${line}`)
      return parsed.filter((record) => recordProblems(record).length === 0)
    }
    return parsed
  } catch (error) {
    console.error(`反馈服务：读取 ${RECORDS_FILE} 失败，按空库启动：${error.message}`)
    return []
  }
}

/** 首次启动且库为空时，导入站点里已有的记录，让历史反馈不至于消失 */
function importSeedIfEmpty() {
  if (records.length || !SEED_FILE || !fs.existsSync(SEED_FILE)) return
  try {
    const parsed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
    const list = Array.isArray(parsed) ? parsed : (parsed.records ?? [])
    const good = list.filter((record) => recordProblems(record).length === 0)
    if (!good.length) return
    records = good
    saveRecords()
    console.log(`反馈服务：已从种子文件导入 ${good.length} 条历史记录（${path.relative(process.cwd(), SEED_FILE)}）`)
  } catch (error) {
    console.warn(`反馈服务：种子文件导入失败（忽略）：${error.message}`)
  }
}

function saveRecords() {
  writeChain = writeChain.then(async () => {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = `${RECORDS_FILE}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(records, null, 2)}\n`)
    fs.renameSync(tmp, RECORDS_FILE)
  })
  return writeChain
}

/** 下一个可用序号：现有最大序号 + 1（编号不复用，删掉的记录不回收编号） */
function nextSequence() {
  return records.reduce((max, record) => Math.max(max, sequenceOf(record.id) ?? 0), 0) + 1
}

function saveImage(record, index, image) {
  const ext = EXT_BY_TYPE[image.type] ?? 'bin'
  const name = `${record.id.toLowerCase()}-${index + 1}.${ext}`
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  fs.writeFileSync(path.join(UPLOAD_DIR, name), image.bytes)
  return `/media/${name}`
}

/* ---------- 限流 ---------- */

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
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (!value.some((t) => t > windowStart)) hits.delete(key)
    }
  }
  return false
}

/* ---------- HTTP ---------- */

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-admin-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function sendJson(res, status, payload, origin) {
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

function adminOk(req) {
  if (!ADMIN_KEY) return false
  const given = Buffer.from(String(req.headers['x-admin-key'] ?? ''))
  const expected = Buffer.from(ADMIN_KEY)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * 公开列表。
 *
 * withContact 只在该请求带对了管理密钥时为真：联系方式属于提交者的个人信息，
 * 公开响应里一律不带，否则任何访客都能把它抓走。
 */
function listRecords(url, withContact = false) {
  const status = url.searchParams.get('status')
  const limitRaw = Number(url.searchParams.get('limit') ?? 200)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 200
  const filtered = isStatus(status) ? records.filter((record) => record.status === status) : records
  const sorted = [...filtered].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return {
    total: sorted.length,
    records: sorted.slice(0, limit).map((record) => ({
      ...publicRecord(record),
      ...(withContact ? { contact: record.contact ?? '' } : {}),
    })),
  }
}

function serveMedia(req, res, name, origin) {
  // 只允许单层文件名，挡掉 ../ 之类的路径穿越
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    sendJson(res, 400, { ok: false, error: '文件名非法' }, origin)
    return
  }
  const file = path.join(UPLOAD_DIR, name)
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    sendJson(res, 404, { ok: false, error: '图片不存在' }, origin)
    return
  }
  const ext = path.extname(name).slice(1).toLowerCase()
  const body = fs.readFileSync(file)
  res.writeHead(200, {
    'Content-Type': TYPE_BY_EXT[ext] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...corsHeaders(origin),
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin ?? ''
  const url = new URL(req.url ?? '/', 'http://localhost')
  const ip = req.socket.remoteAddress ?? 'unknown'

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin))
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(
      res,
      200,
      {
        ok: true,
        service: 'shota-feedback',
        version: 1,
        records: records.length,
        statuses: records.reduce((acc, record) => {
          acc[record.status] = (acc[record.status] ?? 0) + 1
          return acc
        }, {}),
        dryRun: DRY_RUN,
        time: new Date().toISOString(),
      },
      origin,
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/records') {
    // 写错的筛选条件必须报错：静默忽略会让调用方以为筛选生效了，
    // 然后拿全量数据去做「这个状态是空的」这种结论。
    const wanted = url.searchParams.get('status')
    if (wanted && !isStatus(wanted)) {
      sendJson(res, 400, { ok: false, error: `状态取值非法：${wanted}` }, origin)
      return
    }
    const { total, records: list } = listRecords(url, adminOk(req))
    sendJson(res, 200, { ok: true, generatedAt: new Date().toISOString(), total, records: list }, origin)
    return
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/media/')) {
    serveMedia(req, res, decodeURIComponent(url.pathname.slice('/media/'.length)), origin)
    return
  }

  if (req.method !== 'POST' || !['/submit', '/status'].includes(url.pathname)) {
    sendJson(res, 404, { ok: false, error: '没有这个接口' }, origin)
    return
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    sendJson(res, 403, { ok: false, error: '来源不在允许列表内' }, origin)
    return
  }

  let raw
  try {
    raw = await readBody(req)
  } catch {
    sendJson(res, 413, { ok: false, error: '请求体过大：请减少图片或压缩后再试' }, origin)
    return
  }

  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' }, origin)
    return
  }

  /* ---- 维护者改状态 ---- */
  if (url.pathname === '/status') {
    if (!adminOk(req)) {
      sendJson(res, 403, { ok: false, error: ADMIN_KEY ? '管理密钥不正确' : '服务端未设置 ADMIN_KEY' }, origin)
      return
    }
    const record = records.find((item) => item.id === String(input.id ?? ''))
    if (!record) {
      sendJson(res, 404, { ok: false, error: `没有编号为 ${input.id} 的记录` }, origin)
      return
    }
    if (!isStatus(input.status)) {
      sendJson(res, 400, { ok: false, error: '状态取值非法' }, origin)
      return
    }
    record.status = input.status
    record.updatedAt = new Date().toISOString()
    if (!DRY_RUN) await saveRecords()
    sendJson(res, 200, { ok: true, record: publicRecord(record) }, origin)
    return
  }

  /* ---- 玩家提交 ---- */
  const checked = validateSubmission(input)
  if (checked.error) {
    sendJson(res, 400, { ok: false, error: checked.error }, origin)
    return
  }

  // 限流放在校验之后：格式错误、蜜罐命中的请求不消耗配额，
  // 不然一次手误就会把同一网络下的正常提交一起挡掉。
  if (rateLimited(ip)) {
    sendJson(res, 429, { ok: false, error: `提交过于频繁，每小时最多 ${RATE_LIMIT} 条` }, origin)
    return
  }

  const record = { id: recordId(nextSequence()), ...buildRecord(checked.draft) }

  if (DRY_RUN) {
    sendJson(
      res,
      200,
      {
        ok: true,
        dryRun: true,
        wouldCreate: { ...publicRecord(record), images: checked.images.map((image) => image.name) },
      },
      origin,
    )
    return
  }

  try {
    record.images = checked.images.map((image, index) => saveImage(record, index, image))
    records.push(record)
    await saveRecords()
  } catch (error) {
    // 落盘失败时把记录从内存里撤回，避免内存与磁盘不一致
    records = records.filter((item) => item.id !== record.id)
    console.error(`反馈服务：写入失败 ${error.message}`)
    sendJson(res, 500, { ok: false, error: '服务端写入失败，请稍后重试' }, origin)
    return
  }

  console.log(`收到反馈 ${record.id}：${record.title}`)
  sendJson(res, 201, { ok: true, record: publicRecord(record) }, origin)
})

function start() {
  // 部署时的常见错误是端口被占（另一个实例还在跑），默认的 EADDRINUSE 堆栈
  // 对维护者没有信息量，这里直接说清是什么、怎么办。
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用：先停掉占用它的进程（或改 PORT）再启动。`)
    } else {
      console.error(`反馈服务启动失败：${error.message}`)
    }
    process.exit(1)
  })
  fs.mkdirSync(DATA_DIR, { recursive: true })
  records = loadRecords()
  importSeedIfEmpty()
  server.listen(PORT, () => {
    console.log(`反馈服务已启动：http://127.0.0.1:${PORT}`)
    console.log(`数据目录：${DATA_DIR}（已载入 ${records.length} 条）`)
    console.log(`允许来源：${ALLOWED_ORIGINS.join(', ')}`)
    console.log(`单 IP 限流：${RATE_LIMIT} 条/小时${ADMIN_KEY ? '　已启用 ADMIN_KEY' : '　未设置 ADMIN_KEY（不能改状态）'}`)
    if (DRY_RUN) console.log('DRY_RUN=1：只校验并回显，不写盘')
  })
}

start()