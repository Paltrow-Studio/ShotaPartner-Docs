import { envBadges, hero, heroStats } from '../data/site'
import { modules } from '../data/modules'
import { Icon } from './Icons'
import { Reveal } from './Reveal'

/** 首屏：定位文案 + 环境徽章 + 模块依赖预览 */
export function Hero() {
  return (
    <section id="overview" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* 背景装饰 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_0%,black_5%,transparent_72%)]" />
        <div className="animate-glow absolute -top-40 left-[8%] h-[34rem] w-[34rem] rounded-full bg-violet-600/22 blur-[130px]" />
        <div
          className="animate-glow absolute -top-24 right-[6%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/18 blur-[130px]"
          style={{ animationDelay: '1.6s' }}
        />
        <div className="absolute top-[42%] left-[42%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-600/12 blur-[140px]" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* 左：文案 */}
          <div className="flex flex-col items-start gap-7">
            <Reveal>
              <span className="pill border-violet-400/25 bg-violet-500/10 text-violet-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300" />
                </span>
                {hero.eyebrow}
              </span>
            </Reveal>

            <Reveal delay={60}>
              <h1 className="text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
                <span className="gradient-text">{hero.title}</span>
                <span className="mt-3 block text-xl font-medium tracking-[0.02em] text-slate-300 sm:text-2xl">
                  {hero.titleEn}
                </span>
              </h1>
            </Reveal>

            <Reveal delay={120}>
              <p className="max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">{hero.intro}</p>
            </Reveal>

            <Reveal delay={180}>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={hero.primaryCta.href}
                  className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-950/50 transition-transform hover:-translate-y-0.5"
                >
                  {hero.primaryCta.label}
                  <Icon
                    name="arrowRight"
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
                <a
                  href={hero.secondaryCta.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/4 px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/28 hover:text-white"
                >
                  <Icon name="bug" className="h-4 w-4" />
                  {hero.secondaryCta.label}
                </a>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <ul className="flex flex-wrap gap-2 pt-1">
                {envBadges.map((badge) => (
                  <li key={badge.label} className="pill" title={badge.hint}>
                    <span className="text-slate-500">{badge.label}</span>
                    <span className="font-medium text-slate-200">{badge.value}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* 右：模块依赖预览 */}
          <Reveal delay={160} className="lg:pl-4">
            <div className="card relative overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="chip-mono uppercase tracking-[0.18em] text-slate-500">Module Map</span>
                <span className="pill border-white/8 text-[0.7rem] text-slate-400">1 前置 + 2 内容包</span>
              </div>

              <div className="mt-5 space-y-3">
                {modules.map((mod, index) => (
                  <div key={mod.id} className="relative">
                    <a
                      href={`#module-${mod.id}`}
                      className={`card card-hover flex items-start gap-3.5 p-4 ${mod.accent.border} ${mod.accent.bg}`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${mod.accent.gradient} text-white shadow-lg`}
                      >
                        <Icon
                          name={mod.id === 'api' ? 'branch' : mod.id === 'core' ? 'cube' : 'map'}
                          className="h-4.5 w-4.5"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{mod.name}</span>
                          <span className={`chip-mono ${mod.accent.text}`}>v{mod.version}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-400">{mod.role}</span>
                      </span>
                    </a>
                    {index < modules.length - 1 ? (
                      <div className="flex items-center gap-2 py-1.5 pl-7">
                        <span className="h-3 w-px bg-white/15" />
                        <span className="chip-mono text-[0.68rem] text-slate-500">
                          {index === 0 ? 'Core 依赖 API' : 'Extra-School 只依赖 API'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-relaxed text-slate-500">
                依赖箭头从内容模块指向公共契约层。学校追加包可以脱离游戏本体单独安装 —— 这是本次拆分的主要目标。
              </p>
            </div>
          </Reveal>
        </div>

        {/* 数据条 */}
        <Reveal delay={120}>
          <dl className="mt-16 grid grid-cols-2 gap-3 sm:mt-20 sm:grid-cols-4 sm:gap-4">
            {heroStats.map((stat) => (
              <div key={stat.label} className="card px-5 py-4">
                <dt className="text-2xl font-semibold text-white sm:text-3xl">
                  <span className="gradient-text">{stat.value}</span>
                </dt>
                <dd className="mt-1 text-xs leading-snug text-slate-400 sm:text-sm">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
