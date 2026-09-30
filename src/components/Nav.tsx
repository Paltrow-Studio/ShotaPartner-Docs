import { useEffect, useState } from 'react'
import { Icon, LogoMark } from './Icons'
import { GITHUB_REPO, navItems } from '../data/site'

/** 顶部导航：滚动后加毛玻璃底、自动高亮当前分区、移动端折叠菜单、顶部进度条 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(navItems[0].id)

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY
      setScrolled(top > 16)
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(1, Math.max(0, top / height)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.2, 0.5, 1] },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* 阅读进度 */}
      <div className="h-[2px] w-full bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div
        className={`transition-all duration-300 ${
          scrolled ? 'border-b border-white/10 bg-ink-950/80 backdrop-blur-xl' : 'border-b border-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#overview" className="group flex items-center gap-3" aria-label="回到顶部">
            <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:scale-105" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">伙伴物语</span>
              <span className="chip-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">
                Partner Monogatari
              </span>
            </span>
          </a>

          <ul className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={`rounded-full px-3.5 py-2 text-sm transition-colors duration-200 ${
                    active === item.id
                      ? 'bg-white/8 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer noopener"
              className="hidden items-center gap-2 rounded-full border border-white/12 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:border-white/25 hover:text-white sm:flex"
            >
              <Icon name="github" className="h-4 w-4" />
              GitHub
            </a>
            <a
              href="#feedback"
              className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition-transform hover:-translate-y-0.5 sm:flex"
            >
              提交反馈
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-slate-200 transition-colors hover:border-white/25 lg:hidden"
              aria-label={open ? '关闭菜单' : '打开菜单'}
              aria-expanded={open}
            >
              <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </div>

      {/* 移动端菜单 */}
      {open ? (
        <div className="border-b border-white/10 bg-ink-950/95 backdrop-blur-xl lg:hidden">
          <ul className="mx-auto grid w-full max-w-7xl gap-1 px-5 py-4 sm:px-8">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                    active === item.id ? 'bg-white/8 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {item.label}
                  <Icon name="arrowRight" className="h-4 w-4 opacity-50" />
                </a>
              </li>
            ))}
            <li className="mt-2 flex gap-2">
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-3 text-sm text-slate-200"
              >
                <Icon name="github" className="h-4 w-4" />
                GitHub 仓库
              </a>
              <a
                href="#feedback"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 text-sm font-medium text-white"
              >
                提交反馈
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  )
}
