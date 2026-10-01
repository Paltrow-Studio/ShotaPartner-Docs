#!/usr/bin/env node
/**
 * 内容门禁：不公开收录的角色、机制与实现细节一律不得出现在站点上。
 *
 * 词表以 base64 存放（FORBIDDEN 的 code 字段），仓库里搜不到这些词本身。
 * 新增受限词时执行 `npm run check:content -- --code <词>`，把输出的 code 粘进 FORBIDDEN。
 *
 * 校验两处：
 *   1. src/  —— 文案与数据的源文件（含元信息、结构化数据、问答）
 *   2. dist/ —— 实际发布出去的构建产物（最强的保证：只要内容进了包就拦下）
 *
 * 由 `npm run build` 调用，因此 GitHub Pages 的 CI 也会执行；命中即构建失败。
 * scope 为 both 的词在源文件与产物中都查，src 的词只查源文件
 * （构建产物的压缩代码里出现同名子串属于正常现象）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN = [
  { code: '5oG26a2U5bCR5bm0', scope: 'both', why: '不公开收录的角色' },
  { code: '5aSn54uQ54u4', scope: 'both', why: '不公开收录的坐骑' },
  { code: '54uQ54u4', scope: 'both', why: '不公开收录的坐骑' },
  { code: '54G16a2C54Gr54Sw', scope: 'both', why: '该坐骑的专属机制' },
  { code: 'J2JlaSc=', scope: 'src', why: '该角色在配置中的标识' },
  { code: 'ImJlaSI=', scope: 'src', why: '该角色在配置中的标识' },
  { code: 'ZGlzYWJsZWRCeURlZmF1bHQ=', scope: 'src', why: '不公开的名单标识' },
  { code: '56aB55So', scope: 'both', why: '名单类内部说法' },
  { code: '5pyq56aB55So', scope: 'both', why: '产出范围类内部说法' },
  { code: '57mB5q6W', scope: 'both', why: '不公开收录的机制' },
  { code: '5Z+55YW75Zmo', scope: 'both', why: '不公开收录的机制' },
  { code: '5paw55Sf5YS/', scope: 'both', why: '同上机制的产物' },
  { code: '5a2m5ZGY', scope: 'both', why: '同上机制用词' },
  { code: '5YWl552h', scope: 'both', why: '不公开收录的获取途径' },
  { code: '552h55yg5ZCM5qC3', scope: 'both', why: '不公开收录的获取途径' },
  { code: 'c2hvdGFfbnBj', scope: 'both', why: '实体 id' },
  { code: 'bWluZWNyYWZ0OmhvZXM=', scope: 'both', why: '原版标签名' },
  { code: 'amlv', scope: 'both', why: '无中文名的内部遗留物' },
  { code: '5Y+v6YCJ6KeS6Imy5rGg', scope: 'both', why: '池化说法' },
  { code: 'd29ya19zcGVlZA==', scope: 'both', why: '训练值内部键名' },
  { code: 'c2tpbGxfaGFzdGU=', scope: 'both', why: '训练值内部键名' },
  { code: 'c2tpbGxfcHJvZmljaWVuY3k=', scope: 'both', why: '训练值内部键名' },
  { code: 'L3BhcnRuZXI=', scope: 'both', why: '模组命令' },
  { code: 'L2tpbGw=', scope: 'both', why: '原版命令' },
  { code: 'Y29tbWFuZEdyb3Vwcw==', scope: 'src', why: '命令数据标识' },
  { code: 'Y29tbWFuZE5vdGU=', scope: 'src', why: '命令数据标识' },
]

/** base64 → 原始词；解码结果只存在于内存，不写回任何文件 */
const decode = (code) => Buffer.from(code, 'base64').toString('utf8')

/** 维护入口：打印词的 base64，便于新增受限词 */
if (process.argv[2] === '--code') {
  const words = process.argv.slice(3)
  if (words.length === 0) {
    console.error('用法：npm run check:content -- --code <词> [更多词…]')
    process.exit(1)
  }
  for (const word of words) console.log(`${word}  →  ${Buffer.from(word, 'utf8').toString('base64')}`)
  process.exit(0)
}

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx', '.html', '.css', '.json', '.md', '.svg', '.txt', '.xml'])

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (TEXT_EXT.has(path.extname(entry.name))) files.push(full)
  }
  return files
}

function scan(label, targets) {
  const hits = []
  for (const file of targets) {
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    FORBIDDEN.forEach((rule, order) => {
      if (rule.scope !== 'both' && rule.scope !== label) return
      const term = decode(rule.code)
      lines.forEach((line, index) => {
        if (line.includes(term)) {
          hits.push({ file: path.relative(ROOT, file), line: index + 1, index: order + 1, why: rule.why })
        }
      })
    })
  }
  return hits
}

const hits = [...scan('src', walk(path.join(ROOT, 'src'))), ...scan('dist', walk(path.join(ROOT, 'dist')))]

if (hits.length === 0) {
  console.log(`内容门禁：未发现禁止收录的内容（检查 ${FORBIDDEN.length} 个受限词）`)
  process.exit(0)
}

console.error('内容门禁未通过 —— 以下位置命中了不公开收录的词：')
for (const hit of hits) {
  // 只报位置与规则编号：CI 日志同样是公开的，不打印词本身
  console.error(`  ${hit.file}:${hit.line}  受限词 #${hit.index}（${hit.why}）`)
}
console.error('\n处理方式：从文案/数据中删除，而不是绕过本检查。')
process.exit(1)
