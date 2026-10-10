/**
 * GitHub issue 双向同步（零依赖，Node 18+ 与 Cloudflare Worker 共用）。
 *
 * 反馈服务里的记录是唯一事实源；本模块把它镜像到仓库的 issue 区，并把 issue 侧
 * 的标签 / 开关回读为记录状态。玩家的提交体验不变：页面只跟反馈服务说话，
 * token 只存在服务端（GITHUB_TOKEN），页面与仓库都不接触它。
 *
 * 为什么不让页面直连 GitHub：
 *   1. 创建 issue 必须带 token，打进静态页面等于把 token 公开；
 *   2. 国内访问 api.github.com 不稳（根 README「国内网络下的访问与反馈」有实测）；
 *   3. 反馈区的取向就是「不需要 GitHub 账号」，同步只发生在服务端。
 *
 * 状态映射（两个方向共用同一套规则）：
 *   pending        待处理 ↔ issue open  + 标签「待处理」
 *   investigating  排查中 ↔ issue open  + 标签「排查中」
 *   fixed          已修复 ↔ issue closed + 标签「已修复」
 *   closed         已关闭 ↔ issue closed + 标签「已关闭」
 *
 * 方向裁决按时间戳：记录的 updatedAt 比 issue 的 updated_at 新 → 以记录为准（推），
 * 反之以 issue 为准（回读）。两边一致时什么都不做，因此重复跑是幂等的。
 *
 * 不在同步范围内：
 *   - 带 legacyUrl 的早期记录：它们指向原始 issue，保留作查询，不重复建 issue；
 *   - 未配置 GITHUB_TOKEN：整个模块静默不启用，反馈服务行为与从前完全一样。
 *
 * 隐私：issue 正文只用公开字段，**联系方式永不进 issue**（issue 是公开的）。
 */

import { LIMITS, recordProblems } from './store.mjs'

/** 同步 issue 的识别标签：列表查询、双向匹配都靠它 */
export const SYNC_LABEL = '反馈'

/** 记录状态 ↔ issue 标签。键与 store.mjs 的 STATUSES 一一对应。 */
export const STATUS_LABELS = {
  pending: '待处理',
  investigating: '排查中',
  fixed: '已修复',
  closed: '已关闭',
}

/** 建标签用的说明与颜色（6 位 hex，不带 #）。已存在的标签不会被改动。 */
const LABEL_META = {
  [SYNC_LABEL]: ['0969da', '反馈区同步过来的记录'],
  [STATUS_LABELS.pending]: ['d73a49', '已收到，等维护者确认'],
  [STATUS_LABELS.investigating]: ['fbca04', '正在定位原因'],
  [STATUS_LABELS.fixed]: ['0e8a16', '修复已进入开发版或正式版'],
  [STATUS_LABELS.closed]: ['6a737d', '重复、无法复现或不属于受理范围'],
}

const DEFAULT_REPO = 'Paltrow-Studio/ShotaPartner-Docs'
const DEFAULT_PAGE_URL = 'https://paltrow-studio.github.io/ShotaPartner-Docs/feedback.html'
/** 单次同步最多翻 5 页（每页 100 条）：普通反馈量级远到不了，也挡住失控循环 */
const MAX_ISSUE_PAGES = 5
const TIMEOUT_MS = 10_000

/** 上一轮同步还没结束时挡掉并发的第二轮（同一个进程内） */
let running = false

/**
 * 从环境变量读出同步配置。未配置 token → 返回 null（同步关闭）。
 *
 * @param env  process.env（Node）或 Worker 的 env 绑定
 * @param origin 兜底的服务公开地址（Worker 传请求的 origin，用来拼截图绝对地址）
 */
export function githubConfig(env, origin = '') {
  const token = String(env?.GITHUB_TOKEN ?? '').trim()
  if (!token) return null
  return {
    token,
    repo: String(env.GITHUB_REPO ?? DEFAULT_REPO).trim(),
    apiBase: String(env.GITHUB_API_BASE ?? 'https://api.github.com').replace(/\/+$/, ''),
    baseUrl: String(env.PUBLIC_BASE_URL ?? origin ?? '').replace(/\/+$/, ''),
    pageUrl: String(env.FEEDBACK_PAGE_URL ?? DEFAULT_PAGE_URL),
  }
}

/* ---------- GitHub REST（只用同步需要的几个端点） ---------- */

async function api(config, pathname, { method = 'GET', body } = {}) {
  let signal
  try {
    signal = AbortSignal.timeout(TIMEOUT_MS)
  } catch {
    signal = undefined // 运行时不支持时退回无超时，靠下面的调用方兜底
  }
  const response = await fetch(`${config.apiBase}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'shota-feedback',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  })
  let json = null
  try {
    json = await response.json()
  } catch {
    /* 非 JSON 响应 */
  }
  if (!response.ok) {
    const detail = json?.message ? `：${json.message}` : ''
    throw new Error(`GitHub ${method} ${pathname} 返回 ${response.status}${detail}`)
  }
  return json
}

/** 拉出带同步标签的全部 issue（含已关闭；过滤掉混进列表的 PR） */
async function listSyncIssues(config) {
  const issues = []
  for (let page = 1; page <= MAX_ISSUE_PAGES; page += 1) {
    const batch = await api(
      config,
      `/repos/${config.repo}/issues?state=all&labels=${encodeURIComponent(SYNC_LABEL)}&per_page=100&page=${page}`,
    )
    if (!Array.isArray(batch)) throw new Error('GitHub 返回的 issue 列表格式异常')
    for (const issue of batch) if (!issue.pull_request) issues.push(issue)
    if (batch.length < 100) break
  }
  return issues
}

/**
 * 标签不存在时补建。列表里已有的不动（维护者改过颜色 / 说明也不覆盖）。
 * 撞上并发创建的 422（已存在）当作成功。
 */
async function ensureLabels(config) {
  const existing = new Set()
  for (let page = 1; page <= MAX_ISSUE_PAGES; page += 1) {
    const batch = await api(config, `/repos/${config.repo}/labels?per_page=100&page=${page}`)
    if (!Array.isArray(batch)) break
    for (const label of batch) existing.add(label.name)
    if (batch.length < 100) break
  }
  for (const [name, [color, description]] of Object.entries(LABEL_META)) {
    if (existing.has(name)) continue
    try {
      await api(config, `/repos/${config.repo}/labels`, { method: 'POST', body: { name, color, description } })
    } catch (error) {
      if (!/422/.test(String(error.message))) throw error
    }
  }
}

/* ---------- 状态映射（两个方向共用） ---------- */

/** 记录状态 → issue 的开关与标签 */
export function statusToIssue(status) {
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.pending
  const open = status === 'pending' || status === 'investigating'
  return { state: open ? 'open' : 'closed', labels: [SYNC_LABEL, label] }
}

/**
 * issue 的开关 + 标签 → 记录状态。
 *
 * 有决定性标签就按标签；没有时用开关兜底：
 *   open → 排查中（有「排查中」标签）否则 待处理；
 *   closed 且没有「已修复」标签 → 已关闭（手动关掉、没打修复标 = 不予受理 / 重复）。
 */
export function issueToStatus(issue) {
  const names = labelNames(issue)
  if (names.includes(STATUS_LABELS.fixed)) return 'fixed'
  if (names.includes(STATUS_LABELS.closed)) return 'closed'
  if (issue.state === 'open') return names.includes(STATUS_LABELS.investigating) ? 'investigating' : 'pending'
  return 'closed'
}

function labelNames(issue) {
  return (issue?.labels ?? []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean)
}

/* ---------- 纯拼装：issue 正文 / 标题 / 从 issue 还原记录 ---------- */

function absoluteImageUrl(config, src) {
  if (/^https?:\/\//.test(src)) return src
  if (src.startsWith('/media/') && config.baseUrl) return `${config.baseUrl}${src}`
  return '' // 没配 PUBLIC_BASE_URL 时不摆相对地址（进了 issue 也点不开）
}

/** 记录 → issue 标题：编号打头，方便在 issue 区按 F-0031 搜 */
export function issueTitle(record) {
  return `[${record.id}] ${String(record.title ?? '').trim()}`.trim()
}

/**
 * 记录 → issue 正文。只用公开字段：
 * 联系方式不进正文（issue 全公开），正文与截图地址都来自公开记录。
 */
export function issueBody(record, config) {
  const lines = [
    `> 由反馈区自动同步 · 编号 ${record.id} · 提交于 ${record.createdAt}`,
    `> 反馈页：${config.pageUrl}`,
    '',
    `**版本**：${record.version}`,
    '',
    String(record.content ?? '').trim(),
  ]
  const images = (record.images ?? [])
    .map((src) => absoluteImageUrl(config, src))
    .filter(Boolean)
  if (images.length) {
    lines.push('', '**截图**')
    for (const url of images) lines.push(`![](${url})`)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** `### 名称` 分节（GitHub 表单提交的正文长这样） */
function formSections(body) {
  const sections = {}
  const parts = String(body ?? '').split(/^###\s+/m)
  for (const part of parts.slice(1)) {
    const newline = part.indexOf('\n')
    if (newline < 0) continue
    sections[part.slice(0, newline).trim()] = part.slice(newline + 1).trim()
  }
  return sections
}

/**
 * issue → 一条待导入的记录（编号由调用方分配）。
 *
 * 这是「有人直接在 GitHub 上开 issue」的入口：正文按表单分节取「版本 / 内容」，
 * 取不到就整篇当内容。标题与内容为空时抛错，由调用方记进 problems。
 * 联系方式一律留空——issue 是公开渠道，不从里面收集回访信息。
 */
export function recordFromIssue(issue, id) {
  const body = String(issue?.body ?? '')
  const sections = formSections(body)
  const version =
    (sections['版本'] ?? '').split('\n')[0]?.trim() ||
    /\*\*版本\*\*[：:]\s*(.+)/.exec(body)?.[1]?.trim() ||
    '不确定'
  const content = (sections['内容'] ?? body).trim().slice(0, LIMITS.contentMax)
  const title = String(issue?.title ?? '').replace(/^\[F-\d{1,6}\]\s*/, '').trim().slice(0, LIMITS.titleMax)
  if (!title) throw new Error('issue 没有标题')
  if (!content) throw new Error('issue 正文为空')

  const images = []
  for (const match of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (!images.includes(match[1])) images.push(match[1])
    if (images.length >= LIMITS.imagesMax) break
  }

  return {
    id,
    title,
    version: version.slice(0, 60),
    content,
    contact: '',
    status: issueToStatus(issue),
    images,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at ?? issue.created_at,
    issueUrl: issue.html_url,
    issueNumber: issue.number,
  }
}

function numberFromUrl(url) {
  const match = /\/issues\/(\d+)/.exec(String(url ?? ''))
  return match ? Number(match[1]) : null
}

/** 记录上已关联的 issue 编号（显式字段优先，其次从 issueUrl 里解析） */
function linkedNumber(record) {
  return Number.isFinite(record?.issueNumber) ? record.issueNumber : numberFromUrl(record?.issueUrl)
}

function emptySummary() {
  return { checked: 0, created: 0, linked: 0, imported: 0, pushed: 0, pulled: 0, unchanged: 0, problems: [] }
}

/**
 * 跑一轮完整同步。调用方负责存储（回调注入），本函数不碰文件也不碰 KV：
 *
 *   listRecords()          取全部记录
 *   saveRecord(record)     新记录入列 / 已有记录改字段后持久化
 *   newId()                分配下一个记录编号（仅导入 GitHub 上新建的 issue 时用）
 *   log(message)           进度日志（Node 打 console，Worker 也打 console）
 *
 * 三步：给还没有 issue 的记录补建 → 导入 issue 区里新建的（带「反馈」标签）→
 * 按时间戳对账（推 / 回读）。任何一条失败只进 problems，不拖垮整轮。
 */
export async function runSync({ config, listRecords, saveRecord, newId, log = () => {} }) {
  if (!config) throw new Error('未配置 GITHUB_TOKEN')
  const summary = emptySummary()
  if (running) return { ...summary, skipped: '上一轮同步尚未结束' }
  running = true
  try {
    await ensureLabels(config)
    const issues = await listSyncIssues(config)
    summary.checked = issues.length

    const records = [...(await listRecords())]
    const issuesByNumber = new Map(issues.map((issue) => [issue.number, issue]))
    const byNumber = new Map()
    const byId = new Map()
    const titleIssue = new Map()
    for (const record of records) {
      byId.set(record.id, record)
      const number = linkedNumber(record)
      if (number) byNumber.set(number, record)
    }
    for (const issue of issues) {
      const match = /^\[(F-\d{1,6})\]/.exec(issue.title ?? '')
      if (match && !titleIssue.has(match[1])) titleIssue.set(match[1], issue)
    }

    /* 第一步：新记录补建 issue（跳过早期记录与已关联的） */
    for (const record of records) {
      if (record.legacyUrl || linkedNumber(record)) continue
      const existing = titleIssue.get(record.id)
      if (existing) {
        // 标题里已经有编号（上一轮建过、但链接没写回去）：补链，不重复建
        record.issueUrl = existing.html_url
        record.issueNumber = existing.number
        await saveRecord(record)
        byNumber.set(existing.number, record)
        summary.linked += 1
        continue
      }
      try {
        const issue = await api(config, `/repos/${config.repo}/issues`, {
          method: 'POST',
          body: { title: issueTitle(record), body: issueBody(record, config), labels: statusToIssue(record.status).labels },
        })
        record.issueUrl = issue.html_url
        record.issueNumber = issue.number
        await saveRecord(record)
        byNumber.set(issue.number, record)
        summary.created += 1
        log(`已为 ${record.id} 建立 issue #${issue.number}`)
      } catch (error) {
        summary.problems.push(`${record.id}：建 issue 失败 —— ${error.message}`)
      }
    }

    /* 第二步：issue 区里带「反馈」标签、还没有对应记录的 issue → 导入为记录 */
    for (const issue of issues) {
      if (byNumber.has(issue.number)) continue
      const match = /^\[(F-\d{1,6})\]/.exec(issue.title ?? '')
      if (match && byId.has(match[1])) {
        // 编号对得上某条记录、但记录还没关联链接：补链
        const record = byId.get(match[1])
        if (!linkedNumber(record)) {
          record.issueUrl = issue.html_url
          record.issueNumber = issue.number
          await saveRecord(record)
          byNumber.set(issue.number, record)
          summary.linked += 1
        }
        continue
      }
      try {
        const record = recordFromIssue(issue, await newId())
        const problems = recordProblems(record)
        if (problems.length) {
          summary.problems.push(`#${issue.number}：${problems.join('；')}`)
          continue
        }
        await saveRecord(record)
        byNumber.set(issue.number, record)
        byId.set(record.id, record)
        summary.imported += 1
        log(`已把 issue #${issue.number} 导入为 ${record.id}`)
      } catch (error) {
        summary.problems.push(`#${issue.number}：导入失败 —— ${error.message}`)
      }
    }

    /* 第三步：对账。记录新 → 推到 issue；issue 新 → 回读进记录 */
    for (const [number, record] of byNumber) {
      const issue = issuesByNumber.get(number)
      if (!issue) continue // issue 被删或被移出同步范围：静默跳过，不重建（防重复）
      const recordTime = Date.parse(record.updatedAt ?? record.createdAt) || 0
      const issueTime = Date.parse(issue.updated_at) || 0
      if (recordTime > issueTime) {
        const current = labelNames(issue)
        const desired = [
          SYNC_LABEL,
          STATUS_LABELS[record.status] ?? STATUS_LABELS.pending,
          ...current.filter((name) => name !== SYNC_LABEL && !Object.values(STATUS_LABELS).includes(name)),
        ]
        const sameState = issue.state === statusToIssue(record.status).state
        const sameLabels =
          desired.length === current.length && desired.every((name) => current.includes(name))
        if (sameState && sameLabels) {
          summary.unchanged += 1
          continue
        }
        try {
          await api(config, `/repos/${config.repo}/issues/${number}`, {
            method: 'PATCH',
            body: { state: statusToIssue(record.status).state, labels: [...new Set(desired)] },
          })
          summary.pushed += 1
          log(`${record.id} → issue #${number} 状态已推送`)
        } catch (error) {
          summary.problems.push(`${record.id}：推送状态失败 —— ${error.message}`)
        }
      } else {
        const derived = issueToStatus(issue)
        if (derived !== record.status) {
          const previousStatus = record.status
          const previousUpdatedAt = record.updatedAt
          record.status = derived
          record.updatedAt = new Date().toISOString()
          try {
            await saveRecord(record)
            summary.pulled += 1
            log(`issue #${number} → ${record.id} 状态回读为 ${derived}`)
          } catch (error) {
            // 写回失败要把内存里的改动撤回去：本进程（Node 版）的记录表是活对象，
            // 不撤会让「内存已改、存储没改」的脏状态活到下一轮，掩盖真正的问题。
            record.status = previousStatus
            record.updatedAt = previousUpdatedAt
            summary.problems.push(`${record.id}：回读状态失败 —— ${error.message}`)
          }
        } else {
          summary.unchanged += 1
        }
      }
    }

    return summary
  } finally {
    running = false
  }
}
