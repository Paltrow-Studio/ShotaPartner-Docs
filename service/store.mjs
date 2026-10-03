/**
 * 反馈服务的共享契约与校验（零依赖，Node 与 Cloudflare Worker 共用）。
 *
 * 站点（src/data/feedback.ts）与这里必须一致：状态、字段名、长度上限、
 * 图片规格。`npm run check:feedback` 会解析两边并逐项比对，任何一处漂移都会
 * 让构建失败——因为漂移的后果是玩家提交被服务端拒绝或记录显示不出来。
 *
 * 本文件不碰存储、不碰网络，只做「把一份提交变成一条记录」的纯逻辑。
 */

/** 反馈状态。与站点 src/data/feedback.ts 的 IssueStatusId 一一对应。 */
export const STATUSES = ['pending', 'investigating', 'fixed', 'closed']

/** 字段规格。titleMin / contentMin 同时写在前端（即时提示）与服务端（最终裁决）。 */
export const LIMITS = {
  titleMin: 4,
  titleMax: 120,
  contentMin: 20,
  contentMax: 4000,
  /** 单条反馈最多几张图 */
  imagesMax: 3,
  /** 单张图解码后的大小上限 */
  imageBytesMax: 3 * 1024 * 1024,
  /** 单次提交里所有图片的总上限 */
  mediaBytesMax: 8 * 1024 * 1024,
  contactMax: 120,
}

/** 允许的图片类型。前端在压缩时也会核对一遍。 */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** 记录编号：F-0001 起，递增。 */
export function recordId(sequence) {
  return `F-${String(sequence).padStart(4, '0')}`
}

/** 编号 → 序号；非法编号返回 null */
export function sequenceOf(id) {
  const match = /^F-(\d{1,6})$/.exec(String(id ?? ''))
  return match ? Number(match[1]) : null
}

export function isStatus(value) {
  return STATUSES.includes(String(value))
}

/** 单行字段：压掉换行与多余空白 */
function line(value, max) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * base64 → 字节。Node 用 Buffer，Worker 用 atob（本文件两边共用，
 * 不能直接写 Buffer，否则 Worker 里会 ReferenceError）。
 */
function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'))
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** data URL → { type, bytes }；不是合法图片 data URL 时返回 null */
export function decodeDataUrl(dataUrl) {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl ?? ''))
  if (!match) return null
  const type = match[1].toLowerCase()
  const base64 = match[2].replace(/\s+/g, '')
  let bytes
  try {
    bytes = base64ToBytes(base64)
  } catch {
    return null
  }
  if (!bytes.length) return null
  return { type, bytes }
}

/** 把上传的图片规整成 { name, type, bytes } 列表；返回 { error } 或 { images } */
export function normalizeImages(input) {
  const list = Array.isArray(input) ? input : []
  if (list.length > LIMITS.imagesMax) {
    return { error: `最多附 ${LIMITS.imagesMax} 张图` }
  }
  const images = []
  let total = 0
  for (const item of list) {
    const decoded = decodeDataUrl(item?.dataUrl ?? item)
    if (!decoded) return { error: '图片格式无法识别，请重新选择' }
    if (!IMAGE_TYPES.includes(decoded.type)) {
      return { error: `图片类型不支持：${decoded.type}（可用 png / jpg / webp / gif）` }
    }
    if (decoded.bytes.length > LIMITS.imageBytesMax) {
      return { error: `单张图不能超过 ${Math.round(LIMITS.imageBytesMax / 1024 / 1024)} MB` }
    }
    total += decoded.bytes.length
    if (total > LIMITS.mediaBytesMax) {
      return { error: `图片合计不能超过 ${Math.round(LIMITS.mediaBytesMax / 1024 / 1024)} MB` }
    }
    images.push({
      name: line(item?.name ?? 'image', 80) || 'image',
      type: decoded.type,
      bytes: decoded.bytes,
    })
  }
  return { images }
}

/**
 * 校验一份提交。
 *
 * 只做服务端该做的判断（长度、类型、蜜罐）；标题写得清不清楚由维护者看，
 * 不在这里拦——玩家的表达方式不该被程序挑剔。
 *
 * @returns {{ error: string } | { draft: object, images: Array }}
 */
export function validateSubmission(input) {
  if (!input || typeof input !== 'object') return { error: '请求体不是 JSON 对象' }
  // 蜜罐：页面上不可见，只有脚本会填。填了就当作垃圾提交丢弃。
  if (String(input.honeypot ?? '').trim() !== '') return { error: '提交被拒绝' }

  const title = line(input.title, LIMITS.titleMax)
  if (title.length < LIMITS.titleMin) return { error: `标题至少 ${LIMITS.titleMin} 个字` }
  if (!title) return { error: '请填写标题' }

  const version = line(input.version, 60)
  if (!version) return { error: '请选择版本' }

  const content = String(input.content ?? '').trim().slice(0, LIMITS.contentMax)
  if (content.length < LIMITS.contentMin) {
    return { error: `内容至少 ${LIMITS.contentMin} 个字：写清现象与复现步骤` }
  }

  const contact = line(input.contact, LIMITS.contactMax)
  const checked = normalizeImages(input.images)
  if (checked.error) return { error: checked.error }

  return { draft: { title, version, content, contact }, images: checked.images }
}

/** 组装一条待写入的记录（不含 id / 序号 / 媒体地址，由存储层补） */
export function buildRecord(draft, now = new Date()) {
  return {
    title: draft.title,
    version: draft.version,
    content: draft.content,
    contact: draft.contact,
    status: 'pending',
    images: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

/**
 * 对外公开的记录：**不带联系方式**。
 * 联系方式只给维护者看（admin.mjs / 管理接口），不进公开列表。
 */
export function publicRecord(record) {
  return {
    id: record.id,
    title: record.title,
    version: record.version,
    content: record.content,
    images: record.images ?? [],
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? record.createdAt,
    /** 历史记录指向早期 issue，新提交没有这个字段 */
    ...(record.legacyUrl ? { legacyUrl: record.legacyUrl } : {}),
  }
}

/** 一次导入的条数上限：补档够用，同时挡住「把整个 KV 塞进一个请求」 */
export const IMPORT_MAX = 500

/**
 * 维护者导入（补档与 Node ↔ Worker 迁移）。
 *
 * 与玩家提交不同：记录已经成型（编号、时间、状态都由调用方给出），因此只判断
 * 「能不能入库」，不重新编号、不改状态。返回的 records 可以直接写存储，
 * problems 里的条目一律不导入——补档时一条坏记录不该拖住其余 22 条。
 *
 * 联系方式在导入时保留：从 Node 版迁到 Worker 版（或反过来）不能让维护者
 * 丢掉回访线索。它依旧只出现在带管理密钥的响应里。
 */
export function prepareImport(input) {
  const list = Array.isArray(input) ? input : input?.records
  if (!Array.isArray(list)) return { records: [], problems: ['请求体里没有 records 数组'] }
  if (list.length > IMPORT_MAX) return { records: [], problems: [`一次最多导入 ${IMPORT_MAX} 条`] }

  const records = []
  const problems = []
  for (const item of list) {
    const issues = recordProblems(item)
    if (issues.length) {
      problems.push(`${item?.id ?? '?'}：${issues.join('；')}`)
      continue
    }
    const clean = publicRecord(item)
    if (typeof item.contact === 'string' && item.contact) {
      clean.contact = item.contact.slice(0, LIMITS.contactMax)
    }
    records.push(clean)
  }
  return { records, problems }
}

/** 记录结构校验：供 scripts/check-feedback-contract.mjs 与自测使用 */
export function recordProblems(record) {
  const problems = []
  const need = (ok, message) => {
    if (!ok) problems.push(message)
  }
  need(sequenceOf(record?.id) !== null, `id 非法：${JSON.stringify(record?.id)}`)
  need(typeof record?.title === 'string' && record.title.length > 0, 'title 为空')
  need(typeof record?.version === 'string' && record.version.length > 0, 'version 为空')
  need(typeof record?.content === 'string' && record.content.length > 0, 'content 为空')
  need(isStatus(record?.status), `status 非法：${JSON.stringify(record?.status)}`)
  need(Array.isArray(record?.images), 'images 不是数组')
  need(
    typeof record?.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(record.createdAt),
    `createdAt 非法：${JSON.stringify(record?.createdAt)}`,
  )
  if (Array.isArray(record?.images)) {
    for (const src of record.images) {
      need(typeof src === 'string' && /^(https?:\/\/|\/media\/)/.test(src), `图片地址非法：${src}`)
    }
  }
  return problems
}