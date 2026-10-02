import {
  FEEDBACK_API,
  LIMITS,
  RECORDS_SEED_URL,
  type FeedbackRecord,
  type RecordsPayload,
} from '../data/feedback'
import type { PreparedImage } from './image'

/**
 * 反馈服务的客户端。
 *
 * 两种数据来源：
 *   1. 配置了 VITE_FEEDBACK_API → 读服务（实时，含新提交）；
 *   2. 未配置 → 读 public/records.json 这份静态副本（只读，页面照常能看历史）。
 *
 * 第 1 种情况下如果服务暂时连不上，会退回静态副本并在页面上说明，
 * 免得玩家看到一片空白就以为反馈区坏了。
 */

export type LoadResult = {
  ok: boolean
  records: FeedbackRecord[]
  generatedAt: string
  /** 数据是否来自实时服务 */
  live: boolean
  /** 需要让玩家知道的情况，例如「服务连不上，显示的是静态副本」 */
  notice?: string
  error?: string
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const response = await fetch(url, init)
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    /* 服务异常时可能返回非 JSON */
  }
  return { status: response.status, json }
}

function normalizeRecords(payload: unknown): FeedbackRecord[] {
  const list = Array.isArray(payload)
    ? payload
    : ((payload as RecordsPayload | null)?.records ?? [])
  return (list as FeedbackRecord[]).filter(
    (record) => record && typeof record.id === 'string' && typeof record.title === 'string',
  )
}

async function loadSeed(): Promise<LoadResult> {
  try {
    const { status, json } = await fetchJson(RECORDS_SEED_URL, { cache: 'no-store' })
    if (status !== 200) throw new Error(`静态副本返回 ${status}`)
    return {
      ok: true,
      records: normalizeRecords(json),
      generatedAt: (json as RecordsPayload)?.generatedAt ?? '',
      live: false,
    }
  } catch (error) {
    return {
      ok: false,
      records: [],
      generatedAt: '',
      live: false,
      error: `读不到记录：${String((error as Error).message ?? error)}`,
    }
  }
}

export async function loadRecords(signal?: AbortSignal): Promise<LoadResult> {
  if (!FEEDBACK_API) return loadSeed()

  try {
    const { status, json } = await fetchJson(`${FEEDBACK_API}/records?limit=200`, { signal, cache: 'no-store' })
    if (status !== 200) throw new Error(`服务返回 ${status}`)
    return {
      ok: true,
      records: normalizeRecords(json),
      generatedAt: (json as RecordsPayload)?.generatedAt ?? '',
      live: true,
    }
  } catch (error) {
    if (signal?.aborted) return { ok: false, records: [], generatedAt: '', live: false, error: '已取消' }
    const seed = await loadSeed()
    return {
      ...seed,
      notice: '实时服务暂时连不上，下面显示的是最近一次同步的静态副本。提交可能也无法成功，稍后再试或使用备用渠道。',
      error: seed.ok ? undefined : String((error as Error).message ?? error),
    }
  }
}

export type SubmitInput = {
  title: string
  version: string
  content: string
  contact: string
  images: PreparedImage[]
  honeypot: string
}

export type SubmitResult = { ok: true; record: FeedbackRecord } | { ok: false; error: string }

/** 服务未配置时的兜底错误信息：让玩家知道该怎么办，而不是只说「失败」 */
export const NO_SERVICE_MESSAGE = '反馈服务尚未上线，暂时无法直接提交。可以复制内容发给维护者，或用备用渠道。'

export async function submitFeedback(input: SubmitInput): Promise<SubmitResult> {
  if (!FEEDBACK_API) return { ok: false, error: NO_SERVICE_MESSAGE }

  const body = {
    title: input.title.trim(),
    version: input.version,
    content: input.content.trim(),
    contact: input.contact.trim(),
    images: input.images.map((image) => ({ name: image.name, type: image.type, dataUrl: image.dataUrl })),
    honeypot: input.honeypot,
  }

  let response: Response
  try {
    response = await fetch(`${FEEDBACK_API}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: '连不上反馈服务：请检查网络后重试，或用备用渠道。' }
  }

  let json: { ok?: boolean; error?: string; record?: FeedbackRecord } | null = null
  try {
    json = await response.json()
  } catch {
    /* 服务异常时可能返回非 JSON */
  }

  if (response.ok && json?.ok && json.record) return { ok: true, record: json.record }

  if (response.status === 413) return { ok: false, error: '图片太大了：请减少张数或先裁剪。' }
  if (response.status === 429) return { ok: false, error: json?.error ?? '提交过于频繁，请稍后再试。' }
  return { ok: false, error: json?.error ?? `提交失败（服务返回 ${response.status}）` }
}

/** 提交前的本地校验，先于网络请求给出提示 */
export function localProblems(input: { title: string; content: string; images: PreparedImage[] }): string[] {
  const problems: string[] = []
  const title = input.title.trim()
  const content = input.content.trim()
  if (title.length < LIMITS.titleMin) problems.push(`标题至少 ${LIMITS.titleMin} 个字`)
  if (content.length < LIMITS.contentMin) problems.push(`内容至少 ${LIMITS.contentMin} 个字`)
  if (input.images.length > LIMITS.imagesMax) problems.push(`最多附 ${LIMITS.imagesMax} 张图`)
  const total = input.images.reduce((sum, image) => sum + image.bytes, 0)
  if (total > LIMITS.mediaBytesMax) {
    problems.push(`图片合计不能超过 ${Math.round(LIMITS.mediaBytesMax / 1024 / 1024)} MB`)
  }
  return problems
}