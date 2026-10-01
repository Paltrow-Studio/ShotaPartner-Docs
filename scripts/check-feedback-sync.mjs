#!/usr/bin/env node
/**
 * 表单同步检查：GitHub Issue 表单必须与站点反馈区一致。
 *
 * 唯一来源是 src/data/feedback.ts（类型名称与描述、标题前缀、标签、涉及模块选项、
 * 各类问题的填写框架、提交前需准备的信息、不予受理的情况）；
 * .github/ISSUE_TEMPLATE/*.yml 只允许按它生成。
 *
 * 检查项：
 *   1. 四个类型与模板文件一一对应；
 *   2. name / description / title / labels 与站点一致；
 *   3. 「涉及模块」下拉选项与站点一致；
 *   4. 「提交前自检」条目与「提交前需准备的信息」逐条对应；
 *   5. 「不予受理的情况」与站点一致；
 *   6. 字段标签与顺序与「填写框架」一致（「环境」展开为其六项）。
 *
 * 由 `npm run build` 调用，因此 GitHub Pages 的 CI 也会执行；不一致即构建失败。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FEEDBACK = path.join(ROOT, 'src/data/feedback.ts')
const TEMPLATE_DIR = path.join(ROOT, '.github/ISSUE_TEMPLATE')

const source = fs.readFileSync(FEEDBACK, 'utf8')
const problems = []
const fail = (msg) => problems.push(msg)

/* ---------- 解析站点数据 ---------- */

const blockOf = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`未找到 ${startMarker}`)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  return source.slice(start, end < 0 ? source.length : end)
}

const fieldOf = (chunk, field) => {
  const m = chunk.match(new RegExp(`${field}:\\s*(?:'([^']*)'|"([^"]*)")`))
  return m ? (m[1] ?? m[2]) : ''
}

// issueTypes
const issueTypes = blockOf('export const issueTypes', 'export type ModuleOption')
  .split(/\n  \{\n/)
  .slice(1)
  .map((chunk) => ({
    id: fieldOf(chunk, 'id'),
    template: fieldOf(chunk, 'template'),
    name: fieldOf(chunk, 'name'),
    desc: fieldOf(chunk, 'desc'),
    titlePrefix: fieldOf(chunk, 'titlePrefix'),
    labels: fieldOf(chunk, 'labels'),
  }))
  .filter((t) => t.id && t.template)

// moduleOptions
const moduleOptions = blockOf('export const moduleOptions', 'export function buildIssueUrl')
  .split(/\n  \{\s/)
  .slice(1)
  .map((chunk) => fieldOf(chunk, 'formOption'))
  .filter(Boolean)

// reportScaffold：每个类型的 heading 顺序 + 「环境」展开项
const scaffoldChunk = blockOf('const reportScaffold', 'export function buildReportDraft')
const scaffold = {}
for (const type of issueTypes) {
  const start = scaffoldChunk.indexOf(`${type.id}: [`)
  if (start < 0) { fail(`站点数据缺少 ${type.id} 的填写框架`); continue }
  const rest = scaffoldChunk.slice(start + type.id.length + 3)
  let depth = 1
  let end = 0
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '[') depth++
    if (rest[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  const body = rest.slice(0, end)
  const sections = []
  for (const m of body.matchAll(/\{\s*heading: '([^']+)',\s*lines: \[([\s\S]*?)\]/g)) {
    const lines = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
    sections.push({ heading: m[1], lines })
  }
  scaffold[type.id] = sections
}

// reportChecklist / reportAntiPatterns
const checklist = [...blockOf('export const reportChecklist', 'export const reportAntiPatterns')
  .matchAll(/title: '([^']+)'/g)].map((m) => m[1])
const antiPatterns = [...blockOf('export const reportAntiPatterns')
  .matchAll(/\n  '([^']+)',/g)].map((m) => m[1])

/* ---------- 解析 Issue 表单（本仓库固定写法，按行解析） ---------- */

function parseForm(file) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const unquote = (v) => {
    const t = v.trim()
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
    if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1)
    return t
  }
  const form = { labels: [], fields: [], markdown: [], preflight: [] }
  let inBody = false
  let current = null
  let currentOption = null
  let inMarkdown = false
  let markdownIndent = 0
  let markdownLines = []
  const flush = () => {
    if (!current) return
    if (current.type === 'markdown') {
      form.markdown.push({ value: markdownLines.join('\n'), indent: markdownIndent })
    } else {
      form.fields.push(current)
    }
    current = null
    inMarkdown = false
    markdownLines = []
  }
  for (const line of lines) {
    if (!inBody) {
      if (/^body:\s*$/.test(line)) inBody = true
      else if (/^name:/.test(line)) form.name = unquote(line.slice(5))
      else if (/^description:/.test(line)) form.description = unquote(line.slice(12))
      else if (/^title:/.test(line)) form.title = unquote(line.slice(6))
      else if (/^labels:/.test(line)) form.labels = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1])
      continue
    }
    if (inMarkdown) {
      const indent = line.match(/^ */)[0].length
      if (line.trim() && indent <= markdownIndent) flush()
      else { markdownLines.push(line.slice(markdownIndent + 2)); continue }
    }
    const trimmed = line.trim()
    const mType = trimmed.match(/^- type: (\S+)$/)
    if (mType) { flush(); current = { type: mType[1], options: [] }; continue }
    if (!current) continue
    if (/^value: \|$/.test(trimmed)) {
      inMarkdown = true
      markdownIndent = line.match(/^ */)[0].length
      markdownLines = []
      continue
    }
    if (/^label:/.test(trimmed) && !trimmed.startsWith('- label:')) {
      current.label = unquote(trimmed.slice(6))
      continue
    }
    const mOpt = trimmed.match(/^- label: (.*)$/)
    if (mOpt) { currentOption = { label: unquote(mOpt[1]) }; current.options.push(currentOption); continue }
    if (/^- /.test(trimmed) && current.options) { current.options.push(unquote(trimmed.slice(2))); continue }
    if (/^id:/.test(trimmed)) { current.id = trimmed.slice(3).trim(); continue }
  }
  flush()
  const preflight = form.fields.find((f) => f.id === 'preflight')
  if (preflight) form.preflight = preflight.options.map((o) => (typeof o === 'string' ? o : o.label))
  form.module = form.fields.find((f) => f.id === 'module')
  const envHeading = [ ...scaffold[issueTypes[0].id] ].find((s) => s.heading === '环境')
  const envLabels = (envHeading?.lines ?? [])
    .map((l) => l.replace(/^-\s*/, '').replace(/：.*$/, '').trim())
    .filter(Boolean)
  form.envLabels = envLabels
  form.expectedLabels = ['涉及模块', '提交前自检']
  return form
}

/* ---------- 结构校验（GitHub 表单schema的基本约束） ---------- */

const ALLOWED_TOP = new Set(['name', 'description', 'title', 'labels', 'assignees', 'body'])
const ALLOWED_TYPE = new Set(['markdown', 'input', 'textarea', 'dropdown', 'checkboxes'])
const MAX_OPTIONS = 25

function validateShape(file, text) {
  const rel = path.relative(ROOT, file)
  const topKeys = [...text.matchAll(/^([a-z_]+):/gm)].map((m) => m[1])
  for (const key of topKeys) {
    if (!ALLOWED_TOP.has(key)) fail(`${rel}：顶层键「${key}」不是 Issue Form 允许的字段`)
  }
  const types = [...text.matchAll(/^\s*- type: (\S+)\s*$/gm)].map((m) => m[1])
  for (const t of types) {
    if (!ALLOWED_TYPE.has(t)) fail(`${rel}：字段类型「${t}」不被支持`)
  }
  const ids = [...text.matchAll(/^\s+id: (\S+)\s*$/gm)].map((m) => m[1])
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dup.length) fail(`${rel}：id 重复（${[...new Set(dup)].join('、')}）`)
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(`${rel}：id「${id}」只能包含字母、数字、下划线与连字符`)
  }
  if (ids.length !== types.filter((t) => t !== 'markdown').length) {
    fail(`${rel}：字段数与 id 数不一致（markdown 区块不应有 id）`)
  }
}

/* ---------- 比对 ---------- */

let checked = 0
for (const type of issueTypes) {
  const file = path.join(TEMPLATE_DIR, type.template)
  if (!fs.existsSync(file)) { fail(`缺少模板文件：.github/ISSUE_TEMPLATE/${type.template}`); continue }
  const form = parseForm(file)
  validateShape(file, fs.readFileSync(file, 'utf8'))
  checked++

  const ymlName = (form.name ?? '').replace(/^\S+\s+/, '')
  if (ymlName !== type.name) fail(`${type.template}：name 应为「${type.name}」，实际「${form.name}」`)
  if ((form.description ?? '') !== type.desc) fail(`${type.template}：description 与站点不一致\n    站点：${type.desc}\n    表单：${form.description}`)
  if ((form.title ?? '').trim() !== `${type.titlePrefix} `.trim()) fail(`${type.template}：title 应为「${type.titlePrefix}」，实际「${form.title}」`)
  if (form.labels.join(',') !== type.labels.split(',').map((s) => s.trim()).join(',')) {
    fail(`${type.template}：labels 应为「${type.labels}」，实际「${form.labels.join(',')}」`)
  }

  const moduleOpts = (form.module?.options ?? []).filter((o) => typeof o === 'string')
  if (moduleOpts.join('|') !== moduleOptions.join('|')) {
    fail(`${type.template}：涉及模块选项与站点不一致\n    站点：${moduleOptions.join(' / ')}\n    表单：${moduleOpts.join(' / ')}`)
  }

  const titles = form.preflight.map((l) => l.split('：')[0].trim())
  if (titles.join('|') !== checklist.join('|')) {
    fail(`${type.template}：提交前自检与「提交前需准备的信息」不一致\n    站点：${checklist.join(' / ')}\n    表单：${titles.join(' / ')}`)
  }

  const antiBlock = form.markdown.find((m) => m.value.includes('不予受理的情况'))
  const anti = antiBlock ? antiBlock.value.split('\n').filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2).trim()) : []
  if (anti.join('|') !== antiPatterns.join('|')) {
    fail(`${type.template}：不予受理的情况与站点不一致\n    站点：${antiPatterns.join(' / ')}\n    表单：${anti.join(' / ')}`)
  }

  const allowedMarkdown = new Set(['不予受理的情况', '环境'])
  for (const m of form.markdown) {
    const heading = m.value.split('\n')[0].replace(/^#+\s*/, '').trim()
    if (!allowedMarkdown.has(heading)) fail(`${type.template}：出现了站点没有的分组「${heading}」`)
  }

  const expected = ['涉及模块', '提交前自检']
  for (const section of scaffold[type.id]) {
    if (section.heading === '环境') expected.push(...form.envLabels)
    else expected.push(section.heading)
  }
  const actual = form.fields.map((f) => f.label)
  const same = expected.length === actual.length && expected.every((l, i) => l === actual[i])
  if (!same) {
    const diff = expected.map((l, i) => (l === actual[i] ? null : `#${i + 1} 站点「${l}」/ 表单「${actual[i] ?? '（无）'}」`)).filter(Boolean)
    const extra = actual.length > expected.length ? `（表单多出：${actual.slice(expected.length).join('、')}）` : ''
    fail(`${type.template}：字段标签或顺序与站点不一致 ${extra}${diff.length ? '\n    ' + diff.join('\n    ') : ''}`)
  }
}

if (problems.length) {
  console.error('表单同步未通过 —— Issue 表单与站点反馈区不一致：')
  for (const p of problems) console.error(`  · ${p}`)
  console.error('\n处理方式：以 src/data/feedback.ts 为准修改 .github/ISSUE_TEMPLATE/*.yml，而不是反过来。')
  process.exit(1)
}
const fieldCount = issueTypes.reduce((n, t) => n + 2 + scaffold[t.id].reduce((m, s2) => m + (s2.heading === '环境' ? 6 : 1), 0), 0)
console.log(`表单同步：${checked} 个 Issue 表单与站点反馈区一致（字段 ${fieldCount} 项、模组选项 ${moduleOptions.length} 项、自检 ${checklist.length} 条）`)
