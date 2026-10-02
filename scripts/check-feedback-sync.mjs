#!/usr/bin/env node
/**
 * 反馈表单的生成与校验（唯一来源：src/data/feedback.ts）。
 *
 *   node scripts/check-feedback-sync.mjs          校验，不一致即退出码 1
 *   node scripts/check-feedback-sync.mjs --write  依据站点数据重新生成 feedback.yml
 *
 * 站点是唯一来源：表单名、说明、标题前缀、标签、版本选项、内容提示、截图说明、
 * 提交须知，全部读自 src/data/feedback.ts。已挂在 npm run build 上。
 *
 * 只有一张表单：玩家填「标题 / 版本 / 内容 / 截图」，问题属于哪一类由维护者判断。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FEEDBACK = path.join(ROOT, 'src/data/feedback.ts')
const TEMPLATE_DIR = path.join(ROOT, '.github/ISSUE_TEMPLATE')
const FORM_FILE = path.join(TEMPLATE_DIR, 'feedback.yml')
const WRITE = process.argv.includes('--write')

const source = fs.readFileSync(FEEDBACK, 'utf8')
const problems = []
const fail = (msg) => problems.push(msg)

/* ---------- 从站点数据里取值 ---------- */

function blockOf(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`未找到 ${startMarker}`)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  return source.slice(start, end < 0 ? source.length : end)
}

const fieldOf = (chunk, field) => {
  const m = chunk.match(new RegExp(`${field}:\\s*(?:'([^']*)'|"([^"]*)")`))
  return m ? (m[1] ?? m[2]) : ''
}

const strConst = (name, endMarker) => {
  const block = blockOf(`export const ${name}`, endMarker)
  const m = block.match(new RegExp(`export const ${name} =[\\s\\S]*?'((?:[^'\\\\]|\\\\.)*)'`))
  return m ? m[1].replace(/\\'/g, "'") : ''
}

const formBlock = blockOf('export const feedbackForm', 'export const versionOptions')
const form = {
  template: fieldOf(formBlock, 'template'),
  name: fieldOf(formBlock, 'name'),
  desc: fieldOf(formBlock, 'desc'),
  titlePrefix: fieldOf(formBlock, 'titlePrefix'),
  labels: fieldOf(formBlock, 'labels'),
}
// 本体版本从 modules.ts 读取，用于还原 versionOptions 里的 ${coreVersion}
const modulesSource = fs.readFileSync(path.join(ROOT, 'src/data/modules.ts'), 'utf8')
const coreVersion =
  modulesSource.match(/id: 'core'[\s\S]*?version: '([^']+)'/)?.[1] ?? ''
const versionOptions = [...blockOf('export const versionOptions', 'export const contentHint')
  .matchAll(/^\s*[`']((?:[^`'\\]|\\.)*)[`'],\s*$/gm)]
  .map((m) => m[1].replace(/\\'/g, "'").replace(/\$\{coreVersion\}/g, coreVersion))
  .filter(Boolean)
if (!coreVersion) fail('src/data/modules.ts：读不到本体版本号（coreVersion）')
const contentHint = strConst('contentHint', 'export const mediaNote')
const mediaNote = strConst('mediaNote', 'export const mediaAccept')
const submitTips = [...blockOf('export const submitTips', 'export type FeedbackDraft')
  .matchAll(/^\s*'((?:[^'\\]|\\.)*)',\s*$/gm)].map((m) => m[1].replace(/\\'/g, "'"))

if (!Object.values(form).every(Boolean)) fail('src/data/feedback.ts：feedbackForm 有字段为空')
if (!versionOptions.length) fail('src/data/feedback.ts：versionOptions 为空')
if (!contentHint) fail('src/data/feedback.ts：contentHint 为空')
if (!mediaNote) fail('src/data/feedback.ts：mediaNote 为空')
if (!submitTips.length) fail('src/data/feedback.ts：submitTips 为空')

/* ---------- 生成 ---------- */

const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

function generate() {
  const lines = [
    `# 伙伴物语 / Partner Monogatari —— ${form.name}（唯一的 Issue 表单）`,
    '#',
    '# 玩家只需要填四项：标题、版本、内容、截图（可选）。',
    '# 问题属于哪一类、涉及哪个模块，由维护者看内容判断并补标签，不再要求玩家选择。',
    '#',
    '# 维护提示：本表单由 src/data/feedback.ts 生成，请不要手改字段文案。',
    '#   改站点数据后运行 `node scripts/check-feedback-sync.mjs --write` 重新生成，',
    '#   `npm run build`（含 npm run check:feedback）会校验两边一致。',
    `# labels 必须已存在于本仓库（${form.labels}），否则 GitHub 会静默忽略。`,
    '',
    `name: ${form.name}`,
    `description: ${q(form.desc)}`,
    `title: ${q(`${form.titlePrefix} `)}`,
    `labels: [${form.labels.split(',').map((l) => q(l.trim())).join(', ')}]`,
    'body:',
    '  - type: markdown',
    '    attributes:',
    '      value: |',
    '        不用先读一长串规则：把下面三项填完就可以提交，有截图顺手拖进来。',
    '',
    '  - type: dropdown',
    '    id: version',
    '    attributes:',
    '      label: "版本"',
    '      description: "在游戏里看到的本体版本号；拿不准就选「不确定」，在内容里写明也行。"',
    '      options:',
    ...versionOptions.map((option) => `        - ${q(option)}`),
    '    validations:',
    '      required: true',
    '',
    '  - type: textarea',
    '    id: content',
    '    attributes:',
    '      label: "内容"',
    `      description: ${q(contentHint)}`,
    '      placeholder: "发生了什么 / 怎么重现 / 你希望是什么结果"',
    '    validations:',
    '      required: true',
    '',
    '  - type: upload',
    '    id: media',
    '    attributes:',
    '      label: "截图 / 录屏"',
    `      description: ${q(mediaNote)}`,
    '',
    '  - type: markdown',
    '    attributes:',
    '      value: |',
    '        ## 提交须知',
    '',
    ...submitTips.map((tip) => `        - ${tip}`),
    '',
  ]
  return `${lines.join('\n')}`
}

const generated = generate()

/* ---------- 写入 / 校验 ---------- */

if (WRITE) {
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true })
  fs.writeFileSync(FORM_FILE, generated)
  console.log(`反馈表单：已按站点数据写入 .github/ISSUE_TEMPLATE/${form.template}`)
  process.exit(0)
}

const present = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.yml')).sort()
const extra = present.filter((f) => f !== form.template && f !== 'config.yml')
if (extra.length) {
  fail(`.github/ISSUE_TEMPLATE 下只应保留 ${form.template} 与 config.yml，多出：${extra.join('、')}`)
}
if (!present.includes(form.template)) fail(`缺少表单文件 .github/ISSUE_TEMPLATE/${form.template}`)
else if (fs.readFileSync(FORM_FILE, 'utf8').trimEnd() !== generated.trimEnd()) {
  fail(`${form.template} 与站点数据不一致；改站点后运行 node scripts/check-feedback-sync.mjs --write 重新生成`)
}

/* ---------- 表单结构：GitHub 的 Issue Form 架构校验 ---------- */
// 选择页需要登录，CI 里看不到渲染结果，所以按官方 schema 静态校验字段类型与必备属性，
// 拦住「类型拼错、下拉没有选项、把 id 写在 markdown 上」这类会让表单整张失效的问题。

const ALLOWED_TYPES = new Set(['markdown', 'input', 'textarea', 'dropdown', 'checkboxes', 'upload'])
const TOP_LEVEL_KEYS = new Set(['name', 'description', 'title', 'labels', 'assignees', 'body'])

/** 返回问题列表；空数组表示这张表单结构合法 */
function schemaProblems(text) {
  const found = []
  const rows = text.split('\n')
  const types = rows.map((line) => line.match(/^\s*- type:\s*(\S+)\s*$/)?.[1]).filter(Boolean)
  const ids = [...text.matchAll(/^\s+id:\s*(\S+)\s*$/gm)].map((m) => m[1])

  // 顶层键：只允许 GitHub 认的那几个（缩进的字段属性不算）
  for (const line of rows) {
    const key = line.match(/^([A-Za-z_]+):/)?.[1]
    if (key && !TOP_LEVEL_KEYS.has(key)) found.push(`顶层出现不允许的键：${key}`)
  }

  if (!types.length) found.push('body 里没有任何字段')
  for (const type of types) {
    if (!ALLOWED_TYPES.has(type)) found.push(`不支持的字段类型 ${type}`)
  }
  if (new Set(ids).size !== ids.length) found.push('字段 id 有重复')
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) found.push(`字段 id 含非法字符：${id}`)
  }

  for (const block of text.split(/^\s*- type:\s*/m).slice(1)) {
    const type = block.split('\n')[0].trim()
    const hasLabel = /^\s+label:\s*"/m.test(block)
    if (type === 'markdown') {
      if (!/value:\s*\|/.test(block)) found.push('markdown 字段缺少 attributes.value')
      if (/^\s+id:/m.test(block)) found.push('markdown 字段不允许有 id（GitHub 会报错）')
      continue
    }
    if (!/^\s+id:/m.test(block)) found.push(`${type} 字段缺少 id`)
    if (['input', 'textarea', 'dropdown'].includes(type) && !hasLabel) {
      found.push(`${type} 字段缺少 attributes.label`)
    }
    if (type === 'dropdown') {
      if (!/options:/.test(block)) found.push('dropdown 缺少 options')
      else if (!/^\s{8}-\s+"/m.test(block)) found.push('dropdown 的 options 为空')
    }
    if (type === 'upload' && /(options:|placeholder:)/.test(block)) {
      found.push('upload 字段不支持 options / placeholder')
    }
  }
  return found
}

for (const problem of schemaProblems(generated)) fail(`feedback.yml：${problem}`)

// 自测：确认上面这层守卫不是空转（故意写坏几种，必须都能被认出来）
const selfTests = [
  ['字段类型拼错', generated.replace('  - type: upload', '  - type: uploads'), '不支持的字段类型'],
  [
    'markdown 带 id',
    generated.replace('  - type: markdown\n    attributes:', '  - type: markdown\n    id: note\n    attributes:'),
    'markdown 字段不允许有 id',
  ],
  ['dropdown 选项为空', generated.replace(/^ {8}- ".*"$/gm, ''), 'options 为空'],
  ['字段 id 重复', generated.replace('    id: content', '    id: version'), 'id 有重复'],
  ['顶层多余键', generated.replace('title: "[反馈] "', 'title: "[反馈] "\nfoo: bar'), '顶层出现不允许的键'],
]
for (const [label, mutated, expected] of selfTests) {
  const hits = schemaProblems(mutated)
  if (!hits.some((hit) => hit.includes(expected))) {
    fail(`表单结构校验自测失败：「${label}」没有被认出来（期望包含「${expected}」，实际 ${JSON.stringify(hits)}）`)
  }
}

// 站点链接必须预填标题、版本、内容（截图无法通过链接传递）
const urlStart = source.indexOf('export function buildIssueUrl')
if (urlStart < 0) fail('src/data/feedback.ts：找不到 buildIssueUrl')
else {
  const urlBody = source.slice(urlStart, source.indexOf('\n}', urlStart))
  for (const key of ['title', 'version', 'content']) {
    if (!new RegExp(`${key}:\\s*draft\\.${key}`).test(urlBody)) {
      fail(`src/data/feedback.ts：buildIssueUrl 应预填 ${key}（玩家少填一项就少一步）`)
    }
  }
  if (!/template:\s*feedbackForm\.template/.test(urlBody)) {
    fail('src/data/feedback.ts：buildIssueUrl 应预填模板')
  }
  // 预填的键必须真的是表单字段的 id，否则 GitHub 会静默忽略、玩家白填
  const formIds = [...generated.matchAll(/^\s+id:\s*(\S+)\s*$/gm)].map((m) => m[1])
  for (const key of ['version', 'content']) {
    if (!formIds.includes(key)) fail(`feedback.yml：缺少 id 为 ${key} 的字段，深链预填会失效`)
  }
}

if (problems.length) {
  console.error('反馈表单校验未通过：')
  for (const problem of problems) console.error(`  · ${problem}`)
  process.exit(1)
}
console.log(
  `反馈表单：${form.template} 与站点数据一致（版本选项 ${versionOptions.length} 项、提交须知 ${submitTips.length} 条、字段 版本 / 内容 / 截图）`,
)