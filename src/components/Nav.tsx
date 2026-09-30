import { useEffect, useState } from 'react'
import { navItems, ORG, REPO } from '../data/site'
import { useTheme } from '../lib/theme'

const GITHUB = `https://github.com/${ORG}/${REPO}`

export function Nav() {
  const { theme, setTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(navItems[0].id)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
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
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.15, 0.5, 1] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? 'border-line bg-paper/92 backdrop-blur-sm' : 'border-transparent bg-paper/70'
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <a href="#overview" className="flex items-baseline gap-2.5">
          <span className="font-serif text-[1.05rem] font-semibold tracking-wide text-ink">伙伴物语</span>
          <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint sm:inline">
            Partner Monogatari
          </span>
        </a>

        <ul className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`text-[0.88rem] transition-colors ${
                  active === item.id ? 'text-seal' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <div
            className="hidden items-center rounded-md border border-line p-[2px] sm:flex"
            role="group"
            aria-label="主题"
          >
            {(['light', 'dark'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={`rounded-[3px] px-2 py-[0.15rem] text-[0.74rem] transition-colors ${
                  theme === value ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink'
                }`}
              >
                {value === 'light' ? '日' : '夜'}
              </button>
            ))}
          </div>

          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden text-[0.82rem] text-ink-soft transition-colors hover:text-seal md:inline"
          >
            GitHub
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-soft lg:hidden"
            aria-label={open ? '关闭目录' : '打开目录'}
            aria-expanded={open}
          >
            <span className="text-base leading-none">{open ? '×' : '≡'}</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-line bg-paper lg:hidden">
          <ul className="mx-auto grid w-full max-w-6xl gap-1 px-5 py-4">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between border-b border-dashed border-line py-2.5 text-[0.92rem] ${
                    active === item.id ? 'text-seal' : 'text-ink-soft'
                  }`}
                >
                  {item.label}
                  <span className="num text-ink-faint">§</span>
                </a>
              </li>
            ))}
            <li className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2">
                <span className="text-[0.8rem] text-ink-faint">主题</span>
                <div className="flex items-center rounded-md border border-line p-[2px]">
                  {(['light', 'dark'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      aria-pressed={theme === value}
                      className={`rounded-[3px] px-3 py-1 text-[0.76rem] ${
                        theme === value ? 'bg-ink text-paper' : 'text-ink-faint'
                      }`}
                    >
                      {value === 'light' ? '日间' : '夜间'}
                    </button>
                  ))}
                </div>
              </div>
              <a
                href={GITHUB}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[0.82rem] text-ink-soft"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  )
}
