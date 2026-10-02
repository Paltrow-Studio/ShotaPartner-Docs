/**
 * 反馈服务（Cloudflare Worker 版）。
 *
 * 静态站点存不下玩家提交的数据，而 GitHub 的 issue 表单要求玩家有账号、
 * 还得能打开 github.com。所以这里自己收、自己存：玩家只填标题 / 版本 / 内容，
 * 可选附截图；截图以 data URL 随同一个 JSON 请求上来。
 *
 * 接口契约见 service/CONTRACT.md，字段名与校验规则**全部**来自 service/store.mjs——
 * 本文件不复制那份逻辑，否则页面提示与服务端裁决迟早会漂移。
 * 与 Node 版（service/server.mjs）的差别只有存储：这里用 KV 绑定 RECORDS，
 * Node 版用 DATA_DIR 下的文件；键名与响应体保持一致，两边可以互相迁移。
 *
 * KV 布局：
 *   record:<id>      一条记录的 JSON（含 contact；公开响应一律走 publicRecord 去掉它，
 *                    只有带对 X-Admin-Key 的 GET /records 才附上）
 *   media:<文件名>   图片字节
 *   rate:<ip>:<小时> 限流计数（带 TTL，自己会过期）
 *
 * 环境变量 / 绑定：
 *   RECORDS               KV 命名空间，必需（DRY_RUN=1 的提交演练除外）
 *   ADMIN_KEY             改状态用；**未设置时 POST /status 一律 403**，
 *                         而不是「不设密码就放行」——漏配一个变量的后果应该是关上门。
 *   ALLOWED_ORIGINS       逗号分隔；默认与 service/server.mjs 一致（站点域名 + 本地开发 / 预览端口）
 *   RATE_LIMIT_PER_HOUR   单 IP 每小时提交上限，默认 5；设为 0 表示关闭提交入口
 *   DRY_RUN=1             只校验并回显，一个字节都不写（连限流计数也不写）
 */

import {
  LIMITS,
  validateSubmission,
  buildRecord,
  publicRecord,
  recordId,
  sequenceOf,
  isStatus,
} from './store.mjs'

/**
 * 与 service/server.mjs 保持一致的默认来源列表：站点正式域名 + 本地开发 / 预览端口。
 * 两边必须同源同值，否则本地联调时会出现「Node 版能提交、Worker 版 403」这种怪事。
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://paltrow-studio.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4177',
  'http://127.0.0.1:4177',
  'http://localhost:4178',
  'http://127.0.0.1:4178',
].join(',')

/**
 * 请求体上限。图片走 base64（约为原始字节的 4/3），store.mjs 的合计上限是 8 MiB，
 * 这里按同样的算法留出 JSON 与转义的余量，再在解析前挡掉明显异常的请求——
 * 解析一个几十 MB 的 JSON 会白白吃掉 isolate 内存。与 server.mjs 取值一致。
 */
const MAX_BODY_BYTES = Math.ceil(LIMITS.mediaBytesMax * 1.5) + 512 * 1024

const KEY_PREFIX = 'record:'
const MEDIA_PREFIX = 'media:'
const RATE_PREFIX = 'rate:'
/** 计数键留两小时：跨过一个整点后旧窗口还能被读到，避免刚过点就从头计数。 */
const RATE_TTL_SECONDS = 2 * 3600
/** KV list 单页上限 */
const LIST_PAGE = 1000
/** 编号撞车时的重试次数 */
const ID_ATTEMPTS = 3

/**
 * 图片类型 ↔ 文件后缀。四种允许的类型一一对应，所以回读时「按后缀反推类型」
 * 就等于提交时的类型，不必再存一个 mediatype:<文件名> 键——少一个键就少一处
 * 「字节还在、类型键没了」的不一致。
 */
const TYPE_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const EXT_TO_TYPE = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** 所有 JSON 响应都带上：契约规定除 /media 外一律 no-store。 */
function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

/**
 * CORS。只回允许列表里的来源：不在列表里时回列表的第一项（而不是回显请求方），
 * 这样浏览器会因为 ACAO 与实际来源不符而拒绝读取，服务端也不必依赖浏览器讲规矩。
 * 带上 Vary: Origin，否则中间缓存会把某个来源的响应喂给另一个来源。
 */
function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-admin-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function rateLimitOf(env) {
  const raw = Number(env.RATE_LIMIT_PER_HOUR ?? 5)
  return Number.isFinite(raw) ? raw : 5
}

function clientIp(request) {
  // Cloudflare 一定会给 cf-connecting-ip；本地 wrangler dev 也有。
  // 退到 x-forwarded-for 只是为了别的运行时垫一层，最后兜底 'unknown'
  // （共享一个桶意味着可能互相挡，但总比自己伪造 IP 更容易被人绕过来得好）。
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

/** 未绑定 KV 时的统一回答：500，且错误信息可以直接给玩家看。 */
function missingStore(env, headers) {
  if (env.RECORDS) return null
  return jsonResponse({ ok: false, error: '服务端未配置存储，请稍后再试' }, 500, headers)
}

/** 定长比较，避免用 === 逐字节短路而泄漏密钥长度 / 前缀。 */
function secretEqual(given, expected) {
  if (!expected) return false
  const a = new TextEncoder().encode(String(given))
  const b = new TextEncoder().encode(String(expected))
  let diff = a.length ^ b.length
  const size = a.length > b.length ? a.length : b.length
  for (let i = 0; i < size; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/** 文件名只允许契约里的字符集：KV 键不是路径，但白名单能挡住奇怪的键与 URL 编码把戏。 */
function isPlainName(name) {
  return /^[A-Za-z0-9._-]{1,120}$/.test(name) && name !== '.' && name !== '..'
}

/** 翻页取全部键名。KV list 单页最多 1000 条，不翻页会在记录变多后静默少算。 */
async function listKeys(env, prefix) {
  const names = []
  let cursor
  for (;;) {
    const page = await env.RECORDS.list({ prefix, limit: LIST_PAGE, ...(cursor ? { cursor } : {}) })
    for (const key of page.keys ?? []) names.push(key.name)
    const next = page.list_complete ? null : page.cursor
    if (!next || next === cursor) break
    cursor = next
  }
  return names
}

/** 读出所有记录；坏掉的 JSON 直接跳过——一条脏数据不该让整个列表打不开。 */
async function readRecords(env) {
  const names = await listKeys(env, KEY_PREFIX)
  const records = []
  for (const name of names) {
    const raw = await env.RECORDS.get(name)
    if (!raw) continue
    try {
      records.push(JSON.parse(raw))
    } catch {
      /* 跳过损坏的记录 */
    }
  }
  return records
}

/** 当前最大值 +1。不用可变的索引键：那玩意在并发提交下必然互相覆盖。 */
async function nextSequence(env) {
  const names = await listKeys(env, KEY_PREFIX)
  let max = 0
  for (const name of names) {
    const seq = sequenceOf(name.slice(KEY_PREFIX.length))
    if (seq !== null && seq > max) max = seq
  }
  return max + 1
}

/**
 * 限流。KV 的读改写不是原子的：两个 isolate 同时读到 4 就会都写到 5，
 * 所以这是「尽力而为」的防护，挡住的是脚本刷量，不是精确配额。要精确计数
 * 得换 Durable Object 或 D1。计数键按 UTC 整点小时分桶，自己会过期，不用清理。
 */
async function rateLimited(env, ip, limit) {
  if (!(limit > 0)) return true
  const window = new Date().toISOString().slice(0, 13)
  const key = `${RATE_PREFIX}${ip}:${window}`
  const used = Number((await env.RECORDS.get(key)) ?? 0)
  if (Number.isFinite(used) && used >= limit) return true
  await env.RECORDS.put(key, String((Number.isFinite(used) ? used : 0) + 1), {
    expirationTtl: RATE_TTL_SECONDS,
  })
  return false
}

/**
 * GET /health：records 用 KV list 的数量。KV 是最终一致的，这个数可能略滞后。
 *
 * 与 server.mjs 的差异：那边还会报 statuses（按状态计数），这里不报——
 * 它的内存里就有全部记录，而 KV 只能靠 list 拿到键名，算 statuses 得把
 * 每条记录都取一遍；/health 是监控轮询路径，不该为了一个统计字段读整库。
 */
async function handleHealth(env, headers) {
  const missing = missingStore(env, headers)
  if (missing) return missing
  const records = (await listKeys(env, KEY_PREFIX)).length
  return jsonResponse(
    {
      ok: true,
      service: 'shota-feedback',
      version: 1,
      records,
      // 与 server.mjs 一致：部署方一眼能看出自己是不是把生产环境配成了演练模式。
      dryRun: env.DRY_RUN === '1',
      time: new Date().toISOString(),
    },
    200,
    headers,
  )
}

/**
 * GET /records：按 createdAt 倒序，公开响应里没有 contact。
 *
 * 带对了 X-Admin-Key 时才把 contact 附上（维护者回访用）：联系方式是提交者的
 * 个人信息，公开响应里一律不带，否则任何访客都能把它抓走。未设置 ADMIN_KEY
 * 时 secretEqual 永远为假，所以「忘记配密钥」的后果是不显示，而不是全部泄漏。
 */
async function handleRecords(env, url, headers, request) {
  const missing = missingStore(env, headers)
  if (missing) return missing

  const withContact = secretEqual(request.headers.get('x-admin-key') ?? '', env.ADMIN_KEY ?? '')

  // 取值不在 STATUSES 里就报错，不静默忽略：调用方写错筛选条件时，
  // 返回全量会让人拿「这个状态是空的」下结论。空串等于没筛选。
  const status = (url.searchParams.get('status') ?? '').trim()
  if (status && !isStatus(status)) {
    return jsonResponse({ ok: false, error: `状态取值非法：${status}` }, 400, headers)
  }
  const filter = isStatus(status) ? status : ''

  // limit 超出 1~200 时收拢到边界而不是报错：页面永远送合法值，
  // 外部调用方多送一个 0 或 1000 时也不该拿到 500，最多是条数不如预期。
  const limitRaw = (url.searchParams.get('limit') ?? '').trim()
  let limit = 200
  if (limitRaw) {
    const parsed = Number(limitRaw)
    if (Number.isFinite(parsed)) limit = Math.min(200, Math.max(1, Math.trunc(parsed)))
  }

  const records = await readRecords(env)
  records.sort(
    (a, b) =>
      String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')) ||
      String(b?.id ?? '').localeCompare(String(a?.id ?? '')),
  )
  const matched = filter ? records.filter((record) => record?.status === filter) : records

  return jsonResponse(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      // total 是「筛选后、limit 截断前」的条数：调用方据此知道还有多少没取到。
      total: matched.length,
      records: matched.slice(0, limit).map((record) => ({
        ...publicRecord(record),
        ...(withContact ? { contact: record?.contact ?? '' } : {}),
      })),
    },
    200,
    headers,
  )
}

/**
 * GET /media/<文件名>：字节 + 提交时的类型，长缓存；找不到一律 404。
 * 也接 HEAD（与 server.mjs 一致）：边缘会自己去掉响应体，这里不用特殊处理。
 */
async function handleMedia(env, pathname, headers) {
  const missing = missingStore(env, headers)
  if (missing) return missing

  let name
  try {
    name = decodeURIComponent(pathname.slice('/media/'.length))
  } catch {
    return jsonResponse({ ok: false, error: '图片不存在' }, 404, headers)
  }
  if (!isPlainName(name)) return jsonResponse({ ok: false, error: '图片不存在' }, 404, headers)

  const dot = name.lastIndexOf('.')
  const type = EXT_TO_TYPE[dot >= 0 ? name.slice(dot + 1).toLowerCase() : '']
  if (!type) return jsonResponse({ ok: false, error: '图片不存在' }, 404, headers)

  const bytes = await env.RECORDS.get(`${MEDIA_PREFIX}${name}`, { type: 'arrayBuffer' })
  if (!bytes || bytes.byteLength === 0) {
    return jsonResponse({ ok: false, error: '图片不存在' }, 404, headers)
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': type,
      'Content-Length': String(bytes.byteLength),
      // 文件名里含编号，内容永不改变，可以放心 immutable。
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

/** POST /submit */
async function handleSubmit(request, env, headers) {
  const dryRun = env.DRY_RUN === '1'
  // 演练模式对 KV 零写入（连限流计数也不写），所以没有绑定时也能演练；
  // 代价是演练环境不受限流保护——演练本来就不落盘，主要用途是联调与自测。
  if (!dryRun) {
    const missing = missingStore(env, headers)
    if (missing) return missing
  }

  // 先看 Content-Length 再读：明显的巨型请求不该被完整读进内存。
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: '请求体过大：请减少图片或压缩后再试' }, 413, headers)
  }

  let raw
  try {
    raw = await request.text()
  } catch {
    return jsonResponse({ ok: false, error: '请求体读取失败，请重试' }, 400, headers)
  }
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: '请求体过大：请减少图片或压缩后再试' }, 413, headers)
  }

  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    return jsonResponse({ ok: false, error: '请求体不是合法 JSON' }, 400, headers)
  }

  const checked = validateSubmission(input)
  if (checked.error) return jsonResponse({ ok: false, error: checked.error }, 400, headers)

  // 限流放在校验之后：格式错误、蜜罐命中的请求不消耗配额，
  // 不然一次手误就会把同一网络下的正常提交一起挡掉。演练模式直接跳过，
  // 保证 DRY_RUN 对 KV 零接触。
  if (!dryRun) {
    const limit = rateLimitOf(env)
    const ip = clientIp(request)
    if (await rateLimited(env, ip, limit)) {
      return jsonResponse({ ok: false, error: `提交过于频繁，每小时最多 ${limit} 条` }, 429, headers)
    }
  }

  const { draft, images } = checked
  const now = new Date()
  const base = buildRecord(draft, now)

  if (dryRun) {
    // 演练里唯一的读操作是 list（为了报出「将会分配」的编号，与 server.mjs 的回显一致）；
    // 没有任何 put，所以没有绑定时就省掉编号，回一个不带 id 的预览。
    // images 换成客户端给的文件名摘要：真正落库时会变成 /media/<生成的文件名>，
    // 把字节或还不存在的地址回显回去都没有意义。
    const preview = env.RECORDS
      ? publicRecord({ ...base, id: recordId(await nextSequence(env)) })
      : publicRecord(base)
    preview.images = images.map((image) => image.name)
    return jsonResponse({ ok: true, dryRun: true, wouldCreate: preview }, 200, headers)
  }

  // 编号分配：KV 没有原子自增，所以「list 求最大值 +1」，写入前再确认该编号还不存在。
  // KV list 是最终一致的：两个节点几乎同时 list 时可能都看不到对方刚写的记录，
  // 于是算出同一个序号。撞了就在这里重新 list（这时多半已经能看到新记录了）再算一次，
  // 最多 ID_ATTEMPTS 次。极端并发下仍有极小概率撞号——这是选 KV 的代价；
  // 要绝对不撞号得用 Durable Object 或 D1 的唯一约束。
  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
    const id = recordId(await nextSequence(env))
    if (await env.RECORDS.get(`${KEY_PREFIX}${id}`)) continue

    const record = { ...base, id, images: [] }
    for (let index = 0; index < images.length; index += 1) {
      const ext = TYPE_TO_EXT[images[index].type]
      // 文件名由服务端生成（编号 + 序号 + 后缀），不采用客户端给的名字：
      // 玩家给的名字可能带路径分隔符或冲突，而地址要长期稳定、可缓存。
      const filename = `${id.toLowerCase()}-${index + 1}.${ext}`
      // 先写图片再写记录：宁可留下没人引用的孤儿图片，也不要出现记录指向空图。
      await env.RECORDS.put(`${MEDIA_PREFIX}${filename}`, images[index].bytes)
      record.images.push(`/media/${filename}`)
    }
    await env.RECORDS.put(`${KEY_PREFIX}${id}`, JSON.stringify(record))
    return jsonResponse({ ok: true, record: publicRecord(record) }, 201, headers)
  }

  return jsonResponse({ ok: false, error: '编号分配失败，请稍后再试' }, 500, headers)
}

/** POST /status（维护者） */
async function handleStatus(request, env, headers) {
  // 未设置 ADMIN_KEY 一律拒绝（而不是「不设密码就放行」），并且用定长比较。
  // 两种失败给不同的说明：维护者看到「未设置」就知道该去补配置，而不是怀疑密钥抄错了。
  if (!secretEqual(request.headers.get('x-admin-key') ?? '', env.ADMIN_KEY ?? '')) {
    return jsonResponse(
      { ok: false, error: env.ADMIN_KEY ? '管理密钥不正确' : '服务端未设置 ADMIN_KEY' },
      403,
      headers,
    )
  }
  const missing = missingStore(env, headers)
  if (missing) return missing

  let body
  try {
    body = JSON.parse((await request.text()) || '{}')
  } catch {
    return jsonResponse({ ok: false, error: '请求体不是合法 JSON' }, 400, headers)
  }

  // F-1 与 F-0001 指同一条记录，统一按规范编号找键。
  const sequence = sequenceOf(body?.id)
  const key = sequence === null ? '' : `${KEY_PREFIX}${recordId(sequence)}`
  const raw = key ? await env.RECORDS.get(key) : null
  if (!raw) {
    return jsonResponse({ ok: false, error: `没有编号为 ${body?.id ?? ''} 的记录` }, 404, headers)
  }
  if (!isStatus(body?.status)) {
    return jsonResponse({ ok: false, error: '状态取值非法' }, 400, headers)
  }

  let record
  try {
    record = JSON.parse(raw)
  } catch {
    return jsonResponse({ ok: false, error: '这条记录已损坏，请联系维护者' }, 500, headers)
  }

  record.status = body.status
  record.updatedAt = new Date().toISOString()
  // 演练模式回显改动、但不落盘（与 server.mjs 一致）：管理端能对着演练环境走通流程，
  // 而生产数据一个字节都没变。
  if (env.DRY_RUN !== '1') await env.RECORDS.put(key, JSON.stringify(record))
  return jsonResponse({ ok: true, record: publicRecord(record) }, 200, headers)
}

export default {
  async fetch(request, env) {
    const allowed = allowedOrigins(env)
    const origin = request.headers.get('Origin') ?? ''
    const headers = corsHeaders(origin, allowed)
    const url = new URL(request.url)
    const pathname = url.pathname

    // 预检：许可与否交给浏览器按 ACAO 判断，所以这里总是 204。
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    // 来源白名单对整个服务生效：不在列表里的页面连 /records 也不该读到。
    // 无 Origin 的请求（curl、同源、<img>）不受影响。
    if (origin && !allowed.includes(origin)) {
      return jsonResponse({ ok: false, error: '来源不在允许列表内' }, 403, headers)
    }

    if (request.method === 'GET' && pathname === '/health') return handleHealth(env, headers)
    if (request.method === 'GET' && pathname === '/records') {
      return handleRecords(env, url, headers, request)
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && pathname.startsWith('/media/')) {
      return handleMedia(env, pathname, headers)
    }
    if (request.method === 'POST' && pathname === '/submit') {
      return handleSubmit(request, env, headers)
    }
    if (request.method === 'POST' && pathname === '/status') {
      return handleStatus(request, env, headers)
    }

    // 方法不匹配也走这里：契约没有 405，统一 404 省得调用方去猜两套含义。
    return jsonResponse({ ok: false, error: '没有这个接口' }, 404, headers)
  },
}