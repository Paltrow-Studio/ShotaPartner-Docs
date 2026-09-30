import { useCallback, useRef, useState } from 'react'
import { GITHUB_MIRRORS, MIRROR_PROBE_RAW } from '../data/site'

/**
 * 加速节点自动测试与选择。
 *
 * 与 `reach.ts` 的区别：那份只判断「能不能连上 github.com」，用于给出提交路径的提示；
 * 本模块真的把文件下载一遍——这些节点对 raw 路径都返回 `access-control-allow-origin: *`，
 * 所以浏览器可以读到状态码与正文，从而校验节点是否真的可用、并测出往返耗时。
 *
 * 只对资源路径有意义：仓库页 / issue 页等 HTML 页面实测无法经节点访问（403 / 404），
 * 页面据此把「浏览与提交」与「下载」两条路径分开说明，不把加速节点当成提交通道。
 */

export type NodeState = 'checking' | 'ok' | 'fail'

export type ProbeRow = {
  id: string
  label: string
  prefix: string
  direct: boolean
  state: NodeState
  ms: number | null
  note: string
}

const STORAGE_KEY = 'sp-mirror'

async function probeVerified(url: string, timeoutMs: number): Promise<{ ok: boolean; ms: number; note: string }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    const ms = Math.round(performance.now() - started)
    if (!res.ok) return { ok: false, ms, note: `HTTP ${res.status}` }
    const text = await res.text()
    if (!text.includes('<svg')) return { ok: false, ms, note: '返回内容不是目标文件' }
    return { ok: true, ms, note: '' }
  } catch (error) {
    const ms = Math.round(performance.now() - started)
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return { ok: false, ms, note: aborted ? '超时' : '连接失败' }
  } finally {
    window.clearTimeout(timer)
  }
}

/** 把资源地址套上选定节点；prefix 为空表示直连。 */
export function accelerated(prefix: string, target: string): string {
  return prefix ? `${prefix}${target}` : target
}

export function useAccelerator(timeoutMs = 8000) {
  const [rows, setRows] = useState<ProbeRow[]>([])
  const [phase, setPhase] = useState<'idle' | 'testing' | 'done'>('idle')
  const running = useRef(false)

  const check = useCallback(async () => {
    if (running.current) return
    running.current = true
    setPhase('testing')

    const pending: ProbeRow[] = [
      { id: 'direct', label: '直连 raw.githubusercontent.com', prefix: '', direct: true, state: 'checking', ms: null, note: '' },
      ...GITHUB_MIRRORS.map((mirror) => ({
        id: mirror.id,
        label: mirror.label,
        prefix: mirror.prefix,
        direct: false,
        state: 'checking' as NodeState,
        ms: null,
        note: '',
      })),
    ]
    setRows(pending)

    const settled = await Promise.all(
      pending.map(async (row) => {
        const result = await probeVerified(row.direct ? MIRROR_PROBE_RAW : `${row.prefix}${MIRROR_PROBE_RAW}`, timeoutMs)
        return { ...row, state: (result.ok ? 'ok' : 'fail') as NodeState, ms: result.ms, note: result.note }
      }),
    )
    // 可用的排前面，其次按耗时升序
    const ordered = settled.sort(
      (a, b) => Number(b.state === 'ok') - Number(a.state === 'ok') || (a.ms ?? 1e9) - (b.ms ?? 1e9),
    )
    setRows(ordered)
    setPhase('done')
    const best = ordered.find((row) => row.state === 'ok')
    try {
      window.localStorage.setItem(STORAGE_KEY, best ? best.id : '')
    } catch {
      /* 隐私模式下 localStorage 不可写，忽略即可 */
    }
    running.current = false
  }, [timeoutMs])

  const best = rows.find((row) => row.state === 'ok') ?? null
  const usableCount = rows.filter((row) => row.state === 'ok').length

  return { rows, phase, best, usableCount, check }
}
