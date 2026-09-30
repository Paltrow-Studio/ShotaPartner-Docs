import { useCallback, useRef, useState } from 'react'
import type { IssueTypeId } from '../data/feedback'
import type { ModuleId } from '../data/modules'

/**
 * 反馈中继客户端（见 relay/README.md）。
 *
 * 中继是唯一能在国内直接创建 GitHub issue 的路径：它持有服务端令牌调用
 * api.github.com，页面只负责提交经过校验的草稿。未配置中继地址时本模块
 * 不产生任何请求，页面退回复制 / 下载草稿的离线路径。
 */

export type RelayHealth = 'disabled' | 'idle' | 'checking' | 'ok' | 'fail'

export type SubmitInput = {
  type: IssueTypeId
  module: ModuleId | 'unknown'
  summary: string
  body: string
  contact: string
  titlePrefix: string
  moduleTag: string
  /** 蜜罐：页面上不可见，只有脚本会填 */
  honeypot: string
}

export type SubmitResult = { ok: true; url: string; number: number } | { ok: false; error: string }

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

export function useRelay(baseUrl: string, timeoutMs = 8000) {
  const [health, setHealth] = useState<RelayHealth>(baseUrl ? 'idle' : 'disabled')
  const [latency, setLatency] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const running = useRef(false)

  const check = useCallback(async () => {
    if (!baseUrl || running.current) return
    running.current = true
    setHealth('checking')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    const started = performance.now()
    try {
      const res = await fetch(endpoint(baseUrl, '/health'), { cache: 'no-store', signal: controller.signal })
      setLatency(Math.round(performance.now() - started))
      setHealth(res.ok ? 'ok' : 'fail')
    } catch {
      setLatency(null)
      setHealth('fail')
    } finally {
      window.clearTimeout(timer)
      running.current = false
    }
  }, [baseUrl, timeoutMs])

  const submit = useCallback(
    async (input: SubmitInput): Promise<SubmitResult> => {
      if (!baseUrl) return { ok: false, error: '未配置中继地址' }
      setSubmitting(true)
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 20000)
      try {
        const res = await fetch(endpoint(baseUrl, '/issue'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        })
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; detail?: string; issue?: { url: string; number: number } }
          | null
        if (!res.ok || !data?.ok || !data.issue) {
          const detail = data?.detail ? `（${data.detail}）` : ''
          return { ok: false, error: `${data?.error ?? `中继返回 HTTP ${res.status}`}${detail}` }
        }
        setHealth('ok')
        return { ok: true, url: data.issue.url, number: data.issue.number }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError'
        return { ok: false, error: aborted ? '中继响应超时（20 秒）' : '无法连接中继' }
      } finally {
        window.clearTimeout(timer)
        setSubmitting(false)
      }
    },
    [baseUrl],
  )

  return { health, latency, submitting, check, submit }
}
