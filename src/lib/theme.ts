import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'sp-theme'

/**
 * 默认主题按**国内时间**（Asia/Shanghai）判定：
 *   06:00 ~ 17:59 日间 → light；18:00 ~ 05:59 夜间 → dark
 *
 * 与 index.html 内联脚本中的同一套判定必须保持一致（内联脚本负责首屏防闪，
 * 无法 import 本模块），改时段时两处都要改。
 */
export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 18

/** 主题色（移动端浏览器界面配色）跟随实际主题，而不是系统配色 */
const THEME_COLORS: Record<Theme, string> = { light: '#f3eee2', dark: '#191713' }

/** 取国内当前小时；环境缺少时区数据时退回 UTC+8 固定偏移 */
export function chinaHour(now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    if (Number.isFinite(hour)) return hour % 24
  } catch {
    /* 缺少时区数据时用固定偏移 */
  }
  return (now.getUTCHours() + 8) % 24
}

/** 未保存过偏好时的默认主题：按国内时间，白天浅色、夜间深色 */
export function themeByChinaTime(now: Date = new Date()): Theme {
  const hour = chinaHour(now)
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'light' : 'dark'
}

/** 用户显式选择过的主题；没选过返回 null */
function storedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'dark' || saved === 'light' ? saved : null
  } catch {
    return null
  }
}

/** 写入 data-theme 并同步 theme-color */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLORS[theme]
}

function readTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  if (attr === 'dark' || attr === 'light') return attr
  return storedTheme() ?? themeByChinaTime()
}

/**
 * 日间 / 夜间主题。
 *
 * 初始值由 index.html 的内联脚本写在 <html data-theme> 上（首屏防闪），这里只做读写与同步。
 * 未显式选择时主题跟随国内时间：页面长期开着跨过 06:00 / 18:00 会在 10 分钟内自动切换；
 * 一旦用户点过主题按钮，选择写入 localStorage，此后不再自动改变。
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [explicit, setExplicit] = useState<boolean>(() => storedTheme() !== null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (explicit) return
    const timer = window.setInterval(() => setThemeState(themeByChinaTime()), 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [explicit])

  const setTheme = useCallback((next: Theme) => {
    setExplicit(true)
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* 隐私模式下写不进就算了 */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  return { theme, setTheme, toggle }
}
