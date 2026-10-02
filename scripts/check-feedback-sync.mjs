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
}

if (problems.length) {
  console.error('反馈表单校验未通过：')
  for (const problem of problems) console.error(`  · ${problem}`)
  process.exit(1)
}
console.log(
  `反馈表单：${form.template} 与站点数据一致（版本选项 ${versionOptions.length} 项、提交须知 ${submitTips.length} 条、字段 版本 / 内容 / 截图）`,
)