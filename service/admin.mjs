#!/usr/bin/env node
/**
 * 反馈服务维护工具（零依赖）。
 *
 * 维护者用它看记录、改状态、导出站点用的静态种子。改状态走 HTTP 接口
 * （需要 ADMIN_KEY），因此本地和远程部署用法完全一样——远程只要把地址
 * 换成线上服务即可。
 *
 *   node service/admin.mjs list                     列出全部（按时间倒序）
 *   node service/admin.mjs list --status pending     只看待处理
 *   node service/admin.mjs show F-0031               看单条（含联系方式）
 *   node service/admin.mjs status F-0031 fixed       改状态
 *   node service/admin.mjs export --out public/records.json
 *                                                   导出静态种子给站点用
 *
 * 环境变量：
 *   FEEDBACK_URL   服务地址，默认 http://127.0.0.1:8787
 *   ADMIN_KEY      改状态必需；list / show 带上则能看到联系方式
 */

const BASE = (process.env.FEEDBACK_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
const ADMIN_KEY = process.env.ADMIN_KEY ?? ''

const STATUS_LABEL = { pending: '待处理', investigating: '排查中', fixed: '已修复', closed: '已关闭' }

function headers() {
  return ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}
}

async function api(pathname, init = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...headers(), ...(init.headers ?? {}) },
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 上游不是 JSON */
  }
  if (!response.ok || !json?.ok) {
    throw new Error(`${response.status} ${json?.error ?? text.slice(0, 200)}`)
  }
  return json
}

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function pad(text, width) {
  // 中文字符按两个字宽算，否则表格会歪
  const wide = [...String(text)].reduce((sum, char) => sum + (/[\u4e00-\u9fa5（），。：；「」]/.test(char) ? 2 : 1), 0)
  return String(text) + ' '.repeat(Math.max(0, width - wide))
}

function short(text, width) {
  const chars = [...String(text)]
  return chars.length <= width ? String(text) : `${chars.slice(0, width - 1).join('')}…`
}

const command = (process.argv[2] ?? 'list').toLowerCase()

const commands = {
  async list() {
    const status = argValue('--status')
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    const data = await api(`/records${query}`)
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(data, null, 2))
      return
    }
    console.log(`共 ${data.total} 条（${BASE}${ADMIN_KEY ? '，已带管理密钥' : '，未带管理密钥：看不到联系方式'}）`)
    console.log(`${pad('编号', 9)}${pad('状态', 8)}${pad('版本', 20)}${pad('日期', 12)}标题`)
    for (const record of data.records) {
      const date = String(record.createdAt).slice(0, 10)
      console.log(
        `${pad(record.id, 9)}${pad(STATUS_LABEL[record.status] ?? record.status, 8)}${pad(
          short(record.version || '—', 18),
          20,
        )}${pad(date, 12)}${short(record.title, 46)}`,
      )
    }
  },

  async show() {
    const id = process.argv[3]
    if (!id) throw new Error('用法：node service/admin.mjs show <编号>')
    const data = await api('/records?limit=200')
    const record = data.records.find((item) => item.id.toLowerCase() === id.toLowerCase())
    if (!record) throw new Error(`没有编号为 ${id} 的记录`)
    console.log(`编号　　${record.id}`)
    console.log(`状态　　${STATUS_LABEL[record.status] ?? record.status}`)
    console.log(`标题　　${record.title}`)
    console.log(`版本　　${record.version}`)
    console.log(`提交　　${record.createdAt}`)
    if (record.updatedAt) console.log(`更新　　${record.updatedAt}`)
    console.log(`联系　　${record.contact ?? '（未提供，或未带 ADMIN_KEY）'}`)
    if (record.legacyUrl) console.log(`原链接　${record.legacyUrl}`)
    console.log(`图片　　${record.images.length ? record.images.join('、') : '（无）'}`)
    console.log('内容：')
    console.log(record.content)
  },

  async status() {
    // argv: [node, admin.mjs, 'status', <编号>, <状态>]
    const [, , , id, status] = process.argv
    if (!id || !status) throw new Error('用法：node service/admin.mjs status <编号> <pending|investigating|fixed|closed>')
    if (!ADMIN_KEY) throw new Error('改状态需要 ADMIN_KEY 环境变量（与服务端一致）')
    const data = await api('/status', { method: 'POST', body: JSON.stringify({ id, status }) })
    console.log(`${data.record.id} → ${STATUS_LABEL[data.record.status] ?? data.record.status}`)
  },

  async export() {
    const out = argValue('--out') ?? 'public/records.json'
    // 静态副本是要提交进仓库、发布到站点上的，**必须剥掉联系方式**：
    // 带 ADMIN_KEY 请求时接口会附带 contact（供维护者回访），原样写出等于
    // 把提交者的邮箱发布到公开页面。
    const data = await api('/records?limit=200')
    const records = data.records.map(({ contact: _contact, ...rest }) => rest)
    const fs = await import('node:fs')
    const path = await import('node:path')
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
    fs.writeFileSync(
      path.resolve(out),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`,
    )
    console.log(`已导出 ${records.length} 条到 ${out}（联系方式已剥离，不会进仓库）`)
    console.log('这是站点在「未配置服务地址」时显示的静态副本；配置了服务地址时页面直接读服务。')
  },
}

async function main() {
  const run = commands[command]
  if (!run) {
    console.error(`未知命令：${command}`)
    console.error('可用：list、show、status、export')
    process.exit(2)
  }
  try {
    await run()
  } catch (error) {
    console.error(`出错：${error.message}`)
    console.error(`（当前服务地址：${BASE}）`)
    process.exit(1)
  }
}

main()