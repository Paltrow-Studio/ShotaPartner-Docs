#!/usr/bin/env node
/**
 * 反馈区 ↔ issue 区同步的 GitHub Actions 入口（零依赖，Node 18+）。
 *
 * 与「反馈服务自己同步」（配 GITHUB_TOKEN 到服务端，见 service/README.md）是
 * **二选一**的另一条路：同步逻辑跑在 Actions 里，GitHub token 只存在仓库 secret 中，
 * 反馈服务端一个 token 都不用配——国内服务器访问 api.github.com 不稳也不再是问题。
 * 两条路不能同时开：两边同时跑会在「记录还没有 issueUrl」这个窗口里各建一条，产生重复。
 *
 * 对账规则与 service/github.mjs 完全一致（同一个 runSync），只是把存储回调换成了
 * 反馈服务的 HTTP 接口：
 *
 *   读  GET  $FEEDBACK_URL/records          公开记录（结构上永远不含联系方式）
 *   写  POST $FEEDBACK_URL/link             建好 issue 后把链接写回记录
 *   写  POST $FEEDBACK_URL/status           issue 侧改了状态 → 回读进记录
 *   写  POST $FEEDBACK_URL/import           issue 区新开的带标签 issue → 导入成记录
 *   写  GitHub REST                          建 issue / 推送状态（token 只在本进程环境里）
 *
 * 环境变量（workflow 里来自仓库变量与 secret）：
 *   FEEDBACK_URL / FEEDBACK_API  必填：反馈服务地址（仓库变量 FEEDBACK_API，站点部署在用同一个）
 *   ADMIN_KEY                     必填：反馈服务的管理密钥（写回状态 / 链接 / 导入都要它）
 *   GITHUB_TOKEN / GH_TOKEN       必填：同仓库同步用 Actions 内置 GITHUB_TOKEN 即可；
 *                                 用自建 PAT 时存成 secret GH_TOKEN
 *   GITHUB_REPO                   可选：默认取 Actions 注入的 GITHUB_REPOSITORY
 *   PUBLIC_BASE_URL               可选：issue 正文里截图的绝对地址前缀，默认取反馈服务地址
 *
 * 自测：node scripts/sync-issues.selftest.mjs（内存假服务 + 假 GitHub，不需要网络）
 */

import { pathToFileURL } from 'node:url'
import { githubConfig, runSync } from '../service/github.mjs'
import { recordId, sequenceOf } from '../service/store.mjs'

/**
 * 解析并校验配置。
 *   { skip }    —— 没配反馈服务地址：本轮无事可做（不算错误，正常退出）
 *   { config }  —— 就绪
 *   throw       —— 该配没配：这是配置错误，必须让 workflow 变红暴露出来
 */
export function loadConfig(env) {
  const feedbackUrl = String(env.FEEDBACK_URL || env.FEEDBACK_API || '')
    .trim()
    .replace(/\/+$/, '')
  if (!feedbackUrl) return { skip: '未配置仓库变量 FEEDBACK_API（反馈服务地址），本轮跳过' }

  const adminKey = String(env.ADMIN_KEY || '').trim()
  if (!adminKey) {
    throw new Error('未配置 secret ADMIN_KEY（反馈服务的管理密钥）：没有它就无法写回状态与链接')
  }
  const token = String(env.GITHUB_TOKEN || env.GH_TOKEN || '').trim()
  if (!token) {
    throw new Error('未配置 GITHUB_TOKEN：同仓库同步传入 secrets.GITHUB_TOKEN 即可，或自建 PAT 存成 secret GH_TOKEN')
  }

  return {
    feedbackUrl,
    adminKey,
    config: githubConfig({
      ...env,
      GITHUB_TOKEN: token,
      GITHUB_REPO: String(env.GITHUB_REPO ?? env.GITHUB_REPOSITORY ?? '').trim() || undefined,
      // issue 正文里的截图要公网可达：默认就是反馈服务自己的地址
      PUBLIC_BASE_URL: String(env.PUBLIC_BASE_URL ?? '').trim() || feedbackUrl,
    }),
  }
}

/** GET /records：公开记录。limit=200 是服务端契约上限（比这更早的记录本轮看不到）。 */
async function listRecords(feedbackUrl) {
  const response = await fetch(`${feedbackUrl}/records?limit=200`)
  if (!response.ok) throw new Error(`读取反馈记录失败：${feedbackUrl}/records 返回 ${response.status}`)
  const payload = await response.json().catch(() => null)
  if (!payload?.ok || !Array.isArray(payload.records)) {
    throw new Error('反馈服务返回的记录格式不对（ok !== true 或 records 不是数组）')
  }
  return payload.records
}

/** 维护者写回接口（link / status / import）。403/404/400 都抛错，由上层记进 problems。 */
async function post(feedbackUrl, adminKey, pathname, body) {
  const response = await fetch(`${feedbackUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    throw new Error(`${pathname} 返回 ${response.status}${payload?.error ? `：${payload.error}` : ''}`)
  }
  return payload
}

/**
 * 跑一轮同步。返回 runSync 的摘要（skip 时返回带 skipped 的空摘要）。
 *
 * 写回策略：先在内存里记一份「进来时」的状态快照，saveRecord 被调用时 diff 出
 * 真正的改动——
 *   记录不在快照里  → 它是本轮从 issue 导入的新记录 → POST /import
 *   status 变了     → POST /status（issue 侧的状态回读）
 *   issueUrl 变了   → POST /link（刚建好的 issue 链接写回）
 * 同一条记录每轮至多触发一次写回（runSync 的四条路径互不重叠）。
 */
export async function syncOnce(env) {
  const loaded = loadConfig(env)
  if (loaded.skip) {
    console.log(loaded.skip)
    return {
      skipped: loaded.skip,
      checked: 0,
      created: 0,
      linked: 0,
      imported: 0,
      pushed: 0,
      pulled: 0,
      unchanged: 0,
      problems: [],
    }
  }
  const { feedbackUrl, adminKey, config } = loaded

  const records = await listRecords(feedbackUrl)
  /** 快照：id → { status, issueUrl }。必须存值副本，runSync 会原地改记录对象。 */
  const before = new Map(
    records.map((record) => [record.id, { status: record.status, issueUrl: record.issueUrl ?? '' }]),
  )

  return runSync({
    config,
    listRecords: async () => records,
    saveRecord: async (record) => {
      const prior = before.get(record.id)
      if (!prior) {
        // 本轮从 issue 导入的新记录：整条交给 /import（按编号幂等）
        const result = await post(feedbackUrl, adminKey, '/import', { records: [record] })
        if (result.imported !== 1) {
          throw new Error(`导入 ${record.id} 被跳过（编号已被并发提交占用），下一轮会换新编号重试`)
        }
        before.set(record.id, { status: record.status, issueUrl: record.issueUrl ?? '' })
        records.push(record) // 让接下来的 newId 认得这条记录
        return
      }
      if (prior.status !== record.status) {
        await post(feedbackUrl, adminKey, '/status', { id: record.id, status: record.status })
      }
      const issueUrl = record.issueUrl ?? ''
      if (prior.issueUrl !== issueUrl && issueUrl) {
        await post(feedbackUrl, adminKey, '/link', { id: record.id, issueUrl })
      }
      before.set(record.id, { status: record.status, issueUrl })
    },
    newId: async () => {
      const max = records.reduce((top, record) => Math.max(top, sequenceOf(record.id) ?? 0), 0)
      return recordId(max + 1)
    },
    log: (message) => console.log(message),
  })
}

/** 摘要一行话，与 admin.mjs sync 的口径一致 */
export function formatSummary(summary) {
  if (summary.skipped) return summary.skipped
  return (
    `同步完成：对账 ${summary.checked} 条 issue —— 新建 ${summary.created}、补链 ${summary.linked}、` +
    `导入 ${summary.imported}、推送 ${summary.pushed}、回读 ${summary.pulled}、无变化 ${summary.unchanged}` +
    (summary.problems.length ? `；未完成 ${summary.problems.length} 项` : '')
  )
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (invokedDirectly) {
  syncOnce(process.env)
    .then((summary) => {
      console.log(formatSummary(summary))
      for (const problem of summary.problems) console.error(`  · ${problem}`)
      // 有未完成项就让 workflow 变红：宁可吵一次，也别静默漏同步
      if (summary.problems.length) process.exit(1)
    })
    .catch((error) => {
      console.error(`同步失败：${error.message}`)
      process.exit(1)
    })
}
