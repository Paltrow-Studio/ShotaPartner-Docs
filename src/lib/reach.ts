import { useCallback, useRef, useState } from 'react'

/**
 * GitHub 连通性探测。
 *
 * 静态站点无法绕过网络层面的封锁：这里只做「能不能连上」的判断，用来在
 * 反馈区给出可执行的替代路径（生成反馈内容、复制、下载），而不是假装能代理提交页面。
 *
 * 探测方式：no-cors 请求一个 github.com 上的资源。被拦截 / DNS 失败 / 超时都会抛错，
 * 只要拿到任意 HTTP 响应（哪怕是 404）就算这条线路可用。
 */

export type ReachState = 'idle' | 'checking' | 'ok' | 'blocked'

const PROBE_URLS = ['https://github.com/favicon.ico', 'https://api.github.com/']

async function probe(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

export function useGithubReach(timeoutMs = 6000) {
  const [state, setState] = useState<ReachState>('idle')
  const running = useRef(false)

  const check = useCallback(async () => {
    if (running.current) return
    running.current = true
    setState('checking')
    const results = await Promise.all(PROBE_URLS.map((url) => probe(url, timeoutMs)))
    setState(results.some(Boolean) ? 'ok' : 'blocked')
    running.current = false
  }, [timeoutMs])

  return { state, check }
}
