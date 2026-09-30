import { DISCUSSIONS, GITHUB_REPO, ISSUES, ORG_URL, footerNote, navItems } from '../data/site'
import { modules } from '../data/modules'
import { Icon, LogoMark } from './Icons'

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-ink-900/60">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-sm font-semibold text-white">伙伴物语</p>
                <p className="chip-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                  Partner Monogatari
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-500">{footerNote.text}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="pill chip-mono text-[0.68rem]">Minecraft 1.20.1</span>
              <span className="pill chip-mono text-[0.68rem]">Forge 47.4.23</span>
              <span className="pill chip-mono text-[0.68rem]">JDK 17</span>
            </div>
          </div>

          <nav aria-label="页面导航">
            <p className="chip-mono uppercase tracking-[0.16em] text-slate-500">本页</p>
            <ul className="mt-4 space-y-2.5">
              {navItems.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-xs text-slate-400 transition-colors hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="chip-mono uppercase tracking-[0.16em] text-slate-500">三个模块</p>
            <ul className="mt-4 space-y-2.5">
              {modules.map((mod) => (
                <li key={mod.id}>
                  <a
                    href={`#module-${mod.id}`}
                    className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${mod.accent.dot}`} />
                    <span className="chip-mono">{mod.modId}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="chip-mono uppercase tracking-[0.16em] text-slate-500">反馈与联系</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  <Icon name="github" className="h-3.5 w-3.5" />
                  本仓库（Docs）
                </a>
              </li>
              <li>
                <a
                  href={ISSUES}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  <Icon name="bug" className="h-3.5 w-3.5" />
                  问题反馈（Issues）
                </a>
              </li>
              <li>
                <a
                  href={DISCUSSIONS}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  <Icon name="users" className="h-3.5 w-3.5" />
                  讨论区（Discussions）
                </a>
              </li>
              <li>
                <a
                  href={ORG_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  <Icon name="external" className="h-3.5 w-3.5" />
                  Paltrow Studio
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="hairline my-10" />

        <div className="flex flex-col gap-3 text-[0.7rem] leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Paltrow Studio · {footerNote.license}
          </p>
          <p>
            非 Minecraft 官方产品，未经 Mojang 或 Microsoft 批准或关联。本页由 GitHub Pages 托管。
          </p>
        </div>
      </div>
    </footer>
  )
}
