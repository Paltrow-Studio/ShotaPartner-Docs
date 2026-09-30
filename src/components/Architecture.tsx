import { architectureNodes, designPoints } from '../data/modules'
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const constraints: { title: string; desc: string }[] = [
  {
    title: 'modId 不可更改',
    desc: '游戏本体的 modId（shota_partner）是存档、旧附属模组与 Forge 依赖声明的锚点，任何人都不能借用它或改掉它。',
  },
  {
    title: '注册必须早于 FMLCommonSetupEvent',
    desc: '注册表在该事件里冻结。之后注册会被明确拒绝 —— 这是有意的设计，不是缺陷。',
  },
  {
    title: '技能实例不得持有伙伴状态',
    desc: '技能按角色单例共享，per-partner 的可变状态必须放进 ISkillHandler，否则多人时互相串数据。',
  },
  {
    title: '静态状态统一登记清理',
    desc: '皮肤池、补位冷却、模板缓存都是全 JVM 静态状态；必须向 PartnerLifecycle 登记，换存档时才不会残留。',
  },
]

/** 架构分区：依赖拓扑 + 设计取舍 + 硬约束 */
export function Architecture() {
  const core = architectureNodes.find((n) => n.id === 'core')!
  const api = architectureNodes.find((n) => n.id === 'api')!
  const school = architectureNodes.find((n) => n.id === 'school')!

  return (
    <Section id="architecture">
      <SectionHeading
        eyebrow="Architecture"
        title={
          <>
            为什么要拆成 <span className="gradient-text">三个模块</span>
          </>
        }
        desc="原本是一个十几万行的单体模组：想单独更新学校内容，就必须整体重新发布；想给第三方做附属，又拿不到稳定的接口。拆分把「契约」与「内容」分开，让每一层都能独立演进而互不牵连。"
      />

      {/* 依赖拓扑 */}
      <Reveal className="mt-14">
        <div className="card relative overflow-hidden p-6 sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.16),transparent_70%)]"
          />
          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-2">
              {[core, school].map((node) => {
                const mod = node.id === 'core' ? 'core' : 'school'
                const accent = mod === 'core' ? 'violet' : 'amber'
                const ring = accent === 'violet' ? 'border-violet-400/25' : 'border-amber-400/25'
                const text = accent === 'violet' ? 'text-violet-300' : 'text-amber-300'
                const badge = mod === 'core' ? '内容模组 · 必装' : '可选项 · 不依赖本体'
                return (
                  <div key={node.id} className={`card card-hover border ${ring} p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5">
                        <Icon name={mod === 'core' ? 'cube' : 'map'} className={`h-5 w-5 ${text}`} />
                        <span className="text-sm font-semibold text-white">{node.title}</span>
                      </span>
                      <span className="pill chip-mono text-[0.68rem] text-slate-400">{badge}</span>
                    </div>
                    <p className={`chip-mono mt-3 ${text}`}>{node.subtitle}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{node.detail}</p>
                  </div>
                )
              })}
            </div>

            {/* 连接线 */}
            <div className="flex flex-col items-center py-2">
              <svg viewBox="0 0 400 64" className="h-14 w-full max-w-lg" aria-hidden="true">
                <path
                  d="M100 0 V16 Q100 28 118 28 H180 Q198 28 198 40 V50"
                  fill="none"
                  stroke="url(#arch-line)"
                  strokeWidth="1.6"
                />
                <path
                  d="M300 0 V16 Q300 28 282 28 H220 Q202 28 202 40 V50"
                  fill="none"
                  stroke="url(#arch-line)"
                  strokeWidth="1.6"
                />
                <path d="M200 58 l-5 -7 M200 58 l5 -7" fill="none" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" />
                <defs>
                  <linearGradient id="arch-line" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                <span className="pill chip-mono text-[0.68rem] text-slate-400">mandatory · ordering = AFTER</span>
                <span className="pill chip-mono text-[0.68rem] text-slate-400">versionRange [1.0,2)</span>
              </div>
            </div>

            <div className="mx-auto max-w-2xl">
              <div className="card card-hover border border-cyan-400/30 bg-cyan-500/8 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <Icon name="branch" className="h-5 w-5 text-cyan-300" />
                    <span className="text-base font-semibold text-white">{api.title}</span>
                  </span>
                  <span className="pill chip-mono text-[0.68rem] text-cyan-200">前置 · 两个模块都依赖</span>
                </div>
                <p className="chip-mono mt-3 text-cyan-300">{api.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{api.detail}</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* 设计取舍 */}
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {designPoints.map((point, index) => (
          <Reveal key={point.title} delay={index * 60}>
            <article className="card card-hover h-full p-6">
              <h3 className="flex items-start gap-3 text-base font-semibold text-white">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/6 text-violet-300">
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                {point.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{point.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>

      {/* 硬约束 */}
      <Reveal className="mt-6">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
              <Icon name="shield" className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">拆分过程中必须守住的四条约束</h3>
              <p className="mt-0.5 text-sm text-slate-400">
                这些不是风格偏好，而是改动后会让玩家存档或第三方附属模组静默崩溃的红线。
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {constraints.map((item) => (
              <div key={item.title} className="border-l border-white/10 pl-4">
                <p className="text-sm font-medium text-slate-100">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
