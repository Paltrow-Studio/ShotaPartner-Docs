#!/usr/bin/env node
/**
 * 内容门禁：以下内容一律不得出现在站点上。
 *   1. 默认配置下无法获得的角色与其专属内容；
 *   3. 不宜公开的具体获取途径（如「睡眠换取羁绊之尘瓶」）。
 *
 * 校验两处：
 *   1. src/  —— 文案与数据的源文件（含元信息、结构化数据、问答）
 *   2. dist/ —— 实际发布出去的构建产物（最强的保证：只要内容进了包就拦下）
 *
 * 由 `npm run build` 调用，因此 GitHub Pages 的 CI 也会执行；命中即构建失败。
 * （构建产物的压缩代码里出现同名子串属于正常现象）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN = [
]

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
    for (const rule of FORBIDDEN) {
      if (rule.scope !== 'both' && rule.scope !== label) continue
      lines.forEach((line, index) => {
        if (line.includes(rule.term)) {
          hits.push({ file: path.relative(ROOT, file), line: index + 1, term: rule.term, why: rule.why })
        }
      })
    }
  }
  return hits
}

const hits = [...scan('src', walk(path.join(ROOT, 'src'))), ...scan('dist', walk(path.join(ROOT, 'dist')))]

if (hits.length === 0) {
  process.exit(0)
}

console.error('内容门禁未通过 —— 以下内容不得出现在站点上：')
for (const hit of hits) {
  console.error(`  ${hit.file}:${hit.line}  命中「${hit.term}」（${hit.why}）`)
}
console.error('\n处理方式：从文案/数据中删除，而不是绕过本检查。')
process.exit(1)
