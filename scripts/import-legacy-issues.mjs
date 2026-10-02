#!/usr/bin/env node
/**
 * 一次性迁移：把早期 GitHub issue 里的反馈导入成站点记录。
 *
 * 只在迁移 / 补档时手动运行，**不参与构建、不参与部署**：
 * 站点与反馈服务在运行时都不再访问 GitHub。
 *
 *   node scripts/import-legacy-issues.mjs            # 有 GH_TOKEN 走 REST，否则用 gh CLI
 *   node scripts/import-legacy-issues.mjs --out public/records.json
 *
 * 输出 public/records.json：站点在没配置服务地址时显示的静态副本，
 * 同时也是反馈服务首次启动时导入的种子（见 service/server.mjs 的 SEED_FILE）。
 *
 * 归一化：早期 issue 由四套旧模板提交，标题带「[Bug] [Core]」这类前缀、正文是
 * 「### 字段」分段。这里统一压成记录的字段：标题 / 版本 / 内容 / 截图 / 状态 / 时间。
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'Paltrow-Studio/ShotaPartner-Docs'
const CONTENT_MAX = 240

const outIndex = process.argv.indexOf('--out')
const OUT = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : path.join(ROOT, 'public/records.json'))

/** 旧标题前缀，一律去掉 */
const LEGACY_PREFIX = /^\[(Bug|崩溃|兼容|建议|反馈)\]\s*/i
const LEGACY_MODULE = /^\[(Core|API|School|未确定)\]\s*/i

/** 正文里优先取来当「内容」的分段，按这个顺序拼接 */
const CONTENT_SECTIONS = ['内容', '实际结果', '复现步骤', '想解决的问题', '期望的方案', '问题类型', '补充说明']

/** 环境信息与流程说明，不进「内容」 */
const SKIP_SECTIONS = new Set([
  '版本',
  '涉及模块',
  '提交前自检',
  '模组版本',
  'Forge 版本',
  '运行环境',
  'Java 版本',
  '是否使用整合包',
  '模组列表',
  '期望结果',
  '复现频率',
  '最小环境验证',
  '完整日志链接',
  '崩溃报告 / 日志链接',
  '相关日志片段',
  '崩溃栈关键片段',
  '报告指出的可疑模组',
  '崩溃阶段',
  '相关模组',
  '移除该模组后是否恢复',
  '二分定位到的模组',
  '前置依赖是否齐全',
  '考虑过的替代方案',
  '是否可能影响兼容性',
  '参考',
  '截图 / 录屏',
])

/** 标签 → 状态。仓库用「已修复 / 待排查」等中文标签推进。 */
function statusOf(issue) {
  const labels = issue.labels.map((label) => (typeof label === 'string' ? label : label.name))
  if (labels.some((label) => /已修复|已验证|fixed|resolved/i.test(label))) return 'fixed'
  if (labels.some((label) => /排查中|待排查|investigating|in progress/i.test(label))) return 'investigating'
  if (labels.some((label) => /已关闭|wontfix|invalid|duplicate/i.test(label))) return 'closed'
  if (issue.state === 'CLOSED' || issue.state === 'closed') {
    return labels.some((label) => /已修复|fixed/.test(label)) ? 'fixed' : 'closed'
  }
  return 'pending'
}

/** 正文按「### 小标题」切开 */
function sectionsOf(body) {
  const map = new Map()
  let current = ''
  const buf = []
  for (const line of body.split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      if (current || buf.length) map.set(current, buf.join('\n'))
      current = heading[1]
      buf.length = 0
      continue
    }
    buf.push(line)
  }
  if (current || buf.length) map.set(current, buf.join('\n'))
  return map
}

const clean = (text) =>
  text
    .replace(/```[\s\S]*?```/g, ' ') // 代码块（日志片段）不进摘要
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片单独进 images
    .replace(/^\s*[-*]\s*\[[ x]\]\s*/gm, '')
    .replace(/^\s*[-*]\s*/gm, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^_No response_$/i, '')
    .trim()

const truncate = (text, max = CONTENT_MAX) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`

function imagesOf(body) {
  const found = []
  const push = (url) => {
    if (!found.includes(url)) found.push(url)
  }
  for (const match of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) push(match[1])
  for (const match of body.matchAll(/(https:\/\/github\.com\/user-attachments\/assets\/[\w-]+)/g)) push(match[1])
  for (const match of body.matchAll(/(https:\/\/user-images\.githubusercontent\.com\/[\w\-./]+)/g)) push(match[1])
  return found
}

function toRecord(issue) {
  const body = issue.body ?? ''
  const map = sectionsOf(body)

  const title = issue.title.replace(LEGACY_PREFIX, '').replace(LEGACY_MODULE, '').trim() || issue.title.trim()

  // 新表单写「版本」，旧模板写「模组版本」；只取版本号本身，
  // 旧正文里的「0.3.1（Core）/ 1.0.0（API、Extra-School）」这类附注不进记录。
  const versionText = clean(map.get('版本') ?? '') || clean(map.get('模组版本') ?? '')
  const version = versionText.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? '不确定'

  let content = ''
  for (const name of CONTENT_SECTIONS) {
    const text = clean(map.get(name) ?? '')
    if (!text || /^_?no response_?$/i.test(text)) continue
    content = content ? `${content}；${text}` : text
    if (content.length >= CONTENT_MAX) break
  }
  if (!content) {
    content = clean(
      [...map.entries()]
        .filter(([name]) => name && !SKIP_SECTIONS.has(name) && !CONTENT_SECTIONS.includes(name))
        .map(([, text]) => clean(text))
        .filter(Boolean)
        .join('；'),
    )
  }
  if (!content) content = '（早期提交没有留下可读的说明，详见原链接。）'

  const createdAt = issue.createdAt ?? issue.created_at ?? new Date().toISOString()
  const legacyUrl =
    issue.html_url ??
    (typeof issue.url === 'string' && issue.url.startsWith(`https://github.com/${REPO}/`)
      ? issue.url
      : `https://github.com/${REPO}/issues/${issue.number}`)

  return {
    id: `F-${String(issue.number).padStart(4, '0')}`,
    title,
    version,
    content: truncate(content),
    images: imagesOf(body),
    status: statusOf(issue),
    createdAt,
    updatedAt: createdAt,
    legacyUrl,
  }
}

function fetchWithApi(token) {
  const out = execFileSync(
    'curl',
    [
      '-sS',
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      `Authorization: Bearer ${token}`,
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      `https://api.github.com/repos/${REPO}/issues?state=all&per_page=100&sort=created&direction=desc`,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  const parsed = JSON.parse(out)
  if (!Array.isArray(parsed)) throw new Error(parsed.message ?? '接口返回异常')
  return parsed.filter((item) => !item.pull_request)
}

function fetchWithGh() {
  const out = execFileSync(
    'gh',
    ['issue', 'list', '--state', 'all', '--limit', '200', '--json', 'number,title,body,state,labels,createdAt,url'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return JSON.parse(out)
}

function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  let raw = null
  const problems = []
  for (const [label, run] of [
    ['REST API', () => (token ? fetchWithApi(token) : null)],
    ['本机 gh CLI', () => fetchWithGh()],
  ]) {
    try {
      const result = run()
      if (result) {
        raw = result
        console.log(`历史导入：已通过${label}取到 ${raw.length} 条 issue`)
        break
      }
    } catch (error) {
      problems.push(`${label}：${String(error.message ?? error).split('\n')[0]}`)
    }
  }

  if (!raw) {
    console.error('历史导入：取不到 issue，未改动任何文件')
    for (const problem of problems) console.error(`  · ${problem}`)
    process.exit(1)
  }

  const records = raw.map(toRecord).sort((a, b) => a.id.localeCompare(b.id))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`)
  const counts = records.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`历史导入：写入 ${path.relative(ROOT, OUT)}（${records.length} 条，状态 ${JSON.stringify(counts)}）`)
}

main()