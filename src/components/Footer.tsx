import { DISCUSSIONS, GITHUB_REPO, ISSUES, ORG_URL } from '../data/site'

export function Footer() {
  return (
    <footer className="mt-8 border-t border-line bg-paper-sunk/60">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-md">
            <p className="font-serif text-[1.05rem] font-semibold text-ink">伙伴物语</p>
            <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">
              Partner Monogatari
            </p>
            <p className="mt-3 text-[0.84rem] leading-relaxed text-ink-soft">
              模组由 Paltrow Studio 开发。三个模组仓库暂未公开，本页所在仓库对所有人开放，
              问题可在此提交。
            </p>
          </div>

          <nav className="text-[0.84rem]">
            <p className="num uppercase tracking-[0.16em] text-ink-faint">链接</p>
            <ul className="mt-3 space-y-1.5">
              {[
                { href: ISSUES, label: '问题反馈（Issues）' },
                { href: DISCUSSIONS, label: '讨论区（Discussions）' },
                { href: GITHUB_REPO, label: '本仓库' },
                { href: ORG_URL, label: 'Paltrow Studio' },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet inline-block py-1 text-ink-soft"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <hr className="rule my-8" />

        <div className="flex flex-col gap-2 text-[0.78rem] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Paltrow Studio · All Rights Reserved</p>
          <p>非 Minecraft 官方产品，未经 Mojang 或 Microsoft 批准或关联。</p>
        </div>
      </div>
    </footer>
  )
}
