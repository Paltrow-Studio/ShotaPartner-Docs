#!/usr/bin/env node
/**
 * 反馈契约检查：站点（src/data/feedback.ts）与反馈服务（service/store.mjs）必须一致。
 *
 *   node scripts/check-feedback-contract.mjs
 *
 * 为什么需要它：字段名、长度上限、状态取值分散在两个文件里，而它们的后果是
 * 「页面放行、服务端拒绝」或「服务端存了、页面显示不出来」——玩家看到的是提交失败，
 * 却查不出原因。所以把两侧解析出来逐项比对，并校验静态副本，任何漂移都让构建失败。
 *
 * 检查项：
 *   1. LIMITS 的每一项数字相同；
 *   2. 状态取值与顺序相同；
 *   3. 允许的图片类型相同；
 *   4. 记录字段（页面类型 vs 服务端 publicRecord 的键）相同；
 *   5. 服务端两个实现都复用 service/store.mjs，而不是自己复制一份校验；
 *   6. public/records.json 里的每条记录都通过服务端自己的 recordProblems。
 * 最后让同一套规则跑一遍自测：故意改坏六种，任何一种没被认出来就失败。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicRecord, recordProblems } from '../service/store.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE_FILE = path.join(ROOT, 'src/data/feedback.ts')
const STORE_FILE = path.join(ROOT, 'service/store.mjs')
const SEED_FILE = path.join(ROOT, 'public/records.json')
const SERVICE_FILES = ['service/server.mjs', 'service/worker.js']
const CLIENT_FILE = path.join(ROOT, 'src/lib/feedbackClient.ts')

const read = (file) => fs.readFileSync(file, 'utf8')

/* ---------- 解析 ---------- */

/** 从 `KEY = { a: 1, b: 2 }` 里取出所有数字项 */
function numberMap(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  if (open < 0 || close < 0) return null
  const body = source.slice(open + 1, close)
  const map = {}
  for (const match of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(\d+(?:_\d+)*)/g)) {
    map[match[1]] = Number(match[2].replace(/_/g, ''))
  }
  // 兼容 `1 * 1024 * 1024` 这类表达式
  for (const match of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([\d*\s]+)/g)) {
    const key = match[1]
    if (key in map) continue
    const value = match[2].split('*').reduce((product, part) => product * Number(part.trim() || 1), 1)
    if (Number.isFinite(value) && value > 0) map[key] = value
  }
  return map
}

/** 从 `= [ 'a', 'b' ]` 里取出字符串项（保持顺序） */
function stringList(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const open = source.indexOf('[', start)
  const close = source.indexOf(']', open)
  if (open < 0 || close < 0) return null
  return [...source.slice(open + 1, close).matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2])
}

/** 状态（含 label）的 id 顺序 */
function statusIds(source) {
  const marker = source.indexOf('feedbackStatuses')
  if (marker < 0) return null
  // 从数组字面量 `= [` 开始，避免把类型注解 `FeedbackStatus[]` 的 `]` 当成结尾
  const start = source.indexOf('= [', marker)
  if (start < 0) return null
  const end = source.indexOf(']', start)
  return [...source.slice(start, end < 0 ? source.length : end).matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1])
}

/** 对象字面量里的键名（用于比对记录字段） */
function objectKeys(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const open = source.indexOf('{', start)
  const close = source.indexOf('\n}', open)
  if (open < 0 || close < 0) return null
  const body = source.slice(open + 1, close)
  return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]).sort()
}

const site = read(SITE_FILE)
const store = read(STORE_FILE)

const parts = {
  siteLimits: numberMap(site, 'export const LIMITS'),
  storeLimits: numberMap(store, 'export const LIMITS'),
  siteStatuses: statusIds(site),
  storeStatuses: stringList(store, 'export const STATUSES'),
  siteImageTypes: stringList(site, 'export const imageTypes'),
  storeImageTypes: stringList(store, 'export const IMAGE_TYPES'),
  siteRecordFields: objectKeys(site, 'export type FeedbackRecord'),
  storeRecordFields: objectKeys(store, 'export function publicRecord'),
}

/* ---------- 比对（可对任意一对输入重跑，便于自测） ---------- */

function compare({ siteLimits, storeLimits, siteStatuses, storeStatuses, siteImageTypes, storeImageTypes, siteRecordFields, storeRecordFields, serviceSources = [], clientSource = '' }) {
  const found = []

  if (!siteLimits || !storeLimits) found.push('读不到 LIMITS')
  else {
    for (const key of new Set([...Object.keys(siteLimits), ...Object.keys(storeLimits)])) {
      if (siteLimits[key] !== storeLimits[key]) {
        found.push(`LIMITS.${key} 两侧不同：站点 ${siteLimits[key]}，服务端 ${storeLimits[key]}`)
      }
    }
  }

  if (!siteStatuses || !storeStatuses) found.push('读不到状态列表')
  else if (JSON.stringify(siteStatuses) !== JSON.stringify(storeStatuses)) {
    found.push(`状态列表不同：站点 ${JSON.stringify(siteStatuses)}，服务端 ${JSON.stringify(storeStatuses)}`)
  }

  if (!siteImageTypes || !storeImageTypes) found.push('读不到图片类型列表')
  else if (JSON.stringify([...siteImageTypes].sort()) !== JSON.stringify([...storeImageTypes].sort())) {
    found.push(`图片类型不同：站点 ${JSON.stringify(siteImageTypes)}，服务端 ${JSON.stringify(storeImageTypes)}`)
  }

  if (!siteRecordFields || !storeRecordFields) found.push('读不到记录字段')
  else if (JSON.stringify(siteRecordFields) !== JSON.stringify(storeRecordFields)) {
    found.push(`记录字段不同：站点 ${JSON.stringify(siteRecordFields)}，服务端 ${JSON.stringify(storeRecordFields)}`)
  }

  // 服务端实现必须复用共享层，否则字段一改就悄悄分叉
  for (const [file, source] of serviceSources) {
    for (const name of ['validateSubmission', 'publicRecord']) {
      if (!source.includes(name)) found.push(`${file} 没有复用 service/store.mjs 的 ${name}`)
    }
  }

  // 页面提交的字段必须与服务端认的字段一致
  if (clientSource) {
    for (const field of ['title', 'version', 'content', 'contact', 'images', 'honeypot']) {
      if (!clientSource.includes(`${field}:`)) found.push(`src/lib/feedbackClient.ts 的提交体缺少字段 ${field}`)
    }
    if (!/\/submit/.test(clientSource)) found.push('src/lib/feedbackClient.ts 没有调用 /submit')
  }

  return found
}

const inputs = () => ({
  ...parts,
  serviceSources: SERVICE_FILES.map((file) => [file, read(path.join(ROOT, file))]),
  clientSource: read(CLIENT_FILE),
})

const problems = compare(inputs())

/* ---------- 静态副本 ---------- */

function seedProblems(file, source) {
  const found = []
  if (!source) {
    found.push('读不到 public/records.json（先跑一次 npm run seed:legacy）')
    return found
  }
  let payload
  try {
    payload = JSON.parse(source)
  } catch (error) {
    return [`public/records.json 不是合法 JSON：${error.message}`]
  }
  const records = Array.isArray(payload) ? payload : payload.records
  if (!Array.isArray(records) || !records.length) return ['public/records.json 里没有记录']
  for (const record of records) {
    for (const problem of recordProblems(record)) found.push(`${record?.id ?? '?'}：${problem}`)
  }
  const ids = records.map((record) => record.id)
  if (new Set(ids).size !== ids.length) found.push('public/records.json 里有重复编号')
  return found
}

const seedSource = fs.existsSync(SEED_FILE) ? read(SEED_FILE) : ''
problems.push(...seedProblems(SEED_FILE, seedSource))

/* ---------- 自测：确认上面这套规则不是空转 ---------- */

const SELF_TESTS = [
  ['上限数字被改', (input) => ({ ...input, storeLimits: { ...input.storeLimits, contentMax: 999 } }), 'LIMITS.contentMax'],
  ['少了服务端上限', (input) => ({ ...input, siteLimits: { ...input.siteLimits, imagesMax: undefined } }), 'LIMITS.imagesMax'],
  ['状态被改名', (input) => ({ ...input, storeStatuses: ['pending', 'investigating', 'fixed', 'wontfix'] }), '状态列表不同'],
  ['图片类型被放宽', (input) => ({ ...input, storeImageTypes: [...input.storeImageTypes, 'image/svg+xml'] }), '图片类型不同'],
  ['记录字段被删', (input) => ({ ...input, storeRecordFields: input.storeRecordFields.filter((f) => f !== 'version') }), '记录字段不同'],
  ['服务端不再复用共享层', (input) => ({ ...input, serviceSources: [['service/server.mjs', 'const server = 1']] }), '没有复用'],
]

for (const [label, mutate, expected] of SELF_TESTS) {
  const hits = compare(mutate(inputs()))
  if (!hits.some((hit) => hit.includes(expected))) {
    problems.push(`自测失败：「${label}」没有被认出来（期望包含「${expected}」，实际 ${JSON.stringify(hits)}）`)
  }
}

if (problems.length) {
  console.error('反馈契约检查未通过：')
  for (const problem of problems.slice(0, 20)) console.error(`  · ${problem}`)
  if (problems.length > 20) console.error(`  · 另有 ${problems.length - 20} 处`)
  process.exit(1)
}

const recordCount = (JSON.parse(seedSource).records ?? []).length
console.log(
  `反馈契约：站点与反馈服务一致（状态 ${parts.storeStatuses.length} 种、上限 ${Object.keys(parts.storeLimits).length} 项、图片类型 ${parts.storeImageTypes.length} 种、静态副本 ${recordCount} 条）`,
)
export { compare, parts }