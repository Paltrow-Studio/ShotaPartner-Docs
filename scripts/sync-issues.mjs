#!/usr/bin/env node
/**
 * 反馈快照：把仓库里的 issue 抓成 public/issues.json，供进度区与展示区读取。
 *
 * 为什么不在页面里直接调 GitHub API：
 *   1. 站点是纯静态的，从浏览器请求 api.github.com 在部分网络下不可达；
 *   2. 数据随部署一起更新，页面加载不发外部请求，国内访问更稳；
 *   3. 玩家提交的文字不进入 JS 包，内容门禁仍只审我们自己的文案。
 *
 * 归一化：早期的 issue 由四套旧模板（缺陷 / 崩溃 / 兼容 / 建议）提交，
 * 标题带「[Bug] [Core]」这类前缀、正文是「### 字段」分段。这里统一压成
 * 进度区的字段：标题 / 版本 / 内容 / 截图 / 状态 / 时间。
 *
 * 取数顺序：有 GH_TOKEN / GITHUB_TOKEN 走 REST API；否则用本机 gh CLI；
 * 都不可用（离线、无凭据）时保留已有的 public/issues.json 并正常退出，
 * 不阻塞构建。首次生成需要网络。
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/issues.json')
const REPO = 'Paltrow-Studio/ShotaPartner-Docs'
/** 内容摘要在页面上的显示长度：够看懂现象，又不至于把卡片撑长 */
const CONTENT_MAX = 240

/** 旧的标题前缀 → 归一化时一律去掉 */
const LEGACY_PREFIX = /^\[(Bug|崩溃|兼容|建议|反馈)\]\s*/i
const LEGACY_MODULE = /^\[(Core|API|School|未确定)\]\s*/i

/**
 * 正文里优先取来当「内容」的分段，按这个顺序拼接。
 * 第一项是新表单（feedback.yml）的分段名；其余是四套旧模板的分段名。
 */
const CONTENT_SECTIONS = [
  '内容',
  '实际结果',
  '复现步骤',
  '想解决的问题',
  '期望的方案',
  '问题类型',
  '补充说明',
]

/** 这些分段属于环境信息与流程说明，不进「内容」 */
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

/** 标签 → 进度状态。仓库里用「待办 / 待排查」等中文标签推进，未标记的按待处理算。 */
function statusOf(issue) {
  const labels = issue.labels.map((l) => (typeof l === 'string' ? l : l.name))
  if (labels.some((l) => /已修复|已验证|fixed|resolved/i.test(l))) return 'fixed'
  if (labels.some((l) => /排查中|待排查|investigating|in progress/i.test(l))) return 'investigating'
  if (labels.some((l) => /已关闭|wontfix|invalid|duplicate/i.test(l))) return 'closed'
  if (issue.state === 'CLOSED' || issue.state === 'closed') {
    return labels.some((l) => /已修复|fixed/.test(l)) ? 'fixed' : 'closed'
  }
  return 'pending'
}

/** 把正文按「### 小标题」切开 */
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
  return { map, preamble: (map.get('') ?? '').trim() }
}

const clean = (text) =>
  text
    .replace(/```[\s\S]*?```/g, ' ') // 代码块（日志片段）不进摘要
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片单独进 images
    .replace(/^\s*[-*]\s*\[[ x]\]\s*/gm, '') // 自检勾选残留
    .replace(/^\s*[-*]\s*/gm, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^_No response_$/i, '')
    .trim()

function truncate(text, max = CONTENT_MAX) {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function imagesOf(body) {
  const found = []
  for (const match of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) found.push(match[1])
  for (const match of body.matchAll(/(https:\/\/github\.com\/user-attachments\/assets\/[\w-]+)/g)) {
    if (!found.includes(match[1])) found.push(match[1])
  }
  for (const match of body.matchAll(/(https:\/\/user-images\.githubusercontent\.com\/[\w\-./]+)/g)) {
    if (!found.includes(match[1])) found.push(match[1])
  }
  return found
}

function normalize(issue) {
  const rawBody = issue.body ?? ''
  const { map } = sectionsOf(rawBody)

  const images = imagesOf(rawBody)
  let title = issue.title.replace(LEGACY_PREFIX, '').replace(LEGACY_MODULE, '').trim()
  if (!title) title = issue.title.trim()

  // 新表单写「版本」，旧模板写「模组版本」；两者都只取版本号，
  // 旧正文里的「0.3.1（Core）/ 1.0.0（API、Extra-School）」这类附注不进进度区。
  const versionText = clean(map.get('版本') ?? '') || clean(map.get('模组版本') ?? '')
  const version = versionText.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? ''

  let content = ''
  for (const name of CONTENT_SECTIONS) {
    const text = clean(map.get(name) ?? '').replace(/^_No response_$/i, '').trim()
    if (!text || /^_?no response_?$/i.test(text)) continue
    content = content ? `${content}；${text}` : text
    if (content.length >= CONTENT_MAX) break
  }
  if (!content) {
    const rest = [...map.entries()]
      .filter(([name]) => name && !SKIP_SECTIONS.has(name) && !CONTENT_SECTIONS.includes(name))
      .map(([, text]) => clean(text))
      .filter(Boolean)
    content = clean(rest.join('；'))
  }
  if (!content) content = clean(sectionsOf(rawBody).preamble)

  // 取数字段要同时兼容两种来源：REST 是 created_at / html_url，
  // gh CLI 是 createdAt / url（后者的 url 也可能是 api.github.com 地址，只认 html_url 与网页地址）。
  const createdAt = issue.createdAt ?? issue.created_at ?? ''
  const htmlUrl =
    issue.html_url ??
    (typeof issue.url === 'string' && issue.url.startsWith(`https://github.com/${REPO}/`)
      ? issue.url
      : `https://github.com/${REPO}/issues/${issue.number}`)

  return {
    number: issue.number,
    title,
    version,
    content: truncate(content),
    images,
    status: statusOf(issue),
    createdAt,
    url: htmlUrl,
  }
}

/** 写入前的硬校验：字段不全的快照宁可让部署失败，也不要让页面读到半成品。 */
const REQUIRED = {
  number: (v) => Number.isInteger(v) && v > 0,
  title: (v) => typeof v === 'string' && v.length > 0,
  content: (v) => typeof v === 'string',
  status: (v) => ['pending', 'investigating', 'fixed', 'closed'].includes(v),
  createdAt: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v),
  url: (v) => typeof v === 'string' && v.startsWith('https://github.com/'),
}
const ARRAYS = { images: (v) => Array.isArray(v) }

function validateIssues(issues) {
  const bad = []
  for (const issue of issues) {
    for (const [key, ok] of Object.entries(REQUIRED)) {
      if (!ok(issue[key])) bad.push(`#${issue.number ?? '?'} 的 ${key} 非法：${JSON.stringify(issue[key])}`)
    }
    for (const [key, ok] of Object.entries(ARRAYS)) {
      if (!ok(issue[key])) bad.push(`#${issue.number ?? '?'} 的 ${key} 不是数组`)
    }
  }
  return bad
}

/* ---------- 取数 ---------- */

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
    [
      'issue',
      'list',
      '--state',
      'all',
      '--limit',
      '200',
      '--json',
      'number,title,body,state,labels,createdAt,url',
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return JSON.parse(out)
}

function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  let raw = null
  const problems = []
  for (const [label, fn] of [
    ['REST API', () => (token ? fetchWithApi(token) : null)],
    ['本机 gh CLI', () => fetchWithGh()],
  ]) {
    try {
      const result = fn()
      if (result) {
        raw = result
        console.log(`反馈快照：已通过${label}取到 ${raw.length} 条 issue`)
        break
      }
    } catch (error) {
      problems.push(`${label}：${String(error.message ?? error).split('\n')[0]}`)
    }
  }

  if (!raw) {
    const exists = fs.existsSync(OUT)
    console.warn('反馈快照：无法获取 issue，保留现有快照（构建继续）')
    for (const p of problems) console.warn(`  · ${p}`)
    if (!exists) {
      fs.mkdirSync(path.dirname(OUT), { recursive: true })
      fs.writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), issues: [] }, null, 2)}\n`)
      console.warn('  · 没有既有快照，已写入空快照')
    }
    process.exit(0)
  }

  const issues = raw
    .map(normalize)
    .sort((a, b) => b.number - a.number)

  if (!issues.length) {
    console.error('反馈快照：取到的 issue 为空，保留现有快照（不覆盖）')
    process.exit(1)
  }

  const bad = validateIssues(issues)
  if (bad.length) {
    console.error('反馈快照：归一化结果有缺字段，未写入（保留现有快照）：')
    for (const line of bad.slice(0, 10)) console.error(`  · ${line}`)
    if (bad.length > 10) console.error(`  · 另有 ${bad.length - 10} 处`)
    process.exit(1)
  }

  const payload = { generatedAt: new Date().toISOString(), issues }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)

  const counts = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`反馈快照：写入 ${path.relative(ROOT, OUT)}（${issues.length} 条，状态 ${JSON.stringify(counts)}）`)
}

main()