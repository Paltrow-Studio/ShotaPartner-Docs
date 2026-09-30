import { modules } from '../data/modules'
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const requirements = [
  { icon: 'cube', label: 'Minecraft', value: '1.20.1', note: '目前只支持这一个版本' },
  { icon: 'layers', label: 'Forge', value: '47.x', note: '开发基准为 47.4.23' },
  { icon: 'terminal', label: 'Java', value: 'JDK 17', note: 'JDK 21 会导致工具链兼容问题' },
  { icon: 'sparkles', label: 'GeckoLib', value: '4.8.x', note: '仅游戏本体需要，学校包不需要' },
]

const steps = [
  {
    step: '01',
    title: '先放公共前置',
    body: '把 ShotaPartner-API（modId: shota_partner_api）放进 mods 目录。它是两个内容模块的必需前置，加载顺序被声明为 AFTER，会先完成注册表初始化。',
    badges: ['shota_partner_api', 'v1.0.0'],
  },
  {
    step: '02',
    title: '再放游戏本体与动画库',
    body: '放入 ShotaPartner-Core（modId: shota_partner）与 GeckoLib 4.8.x。本体依赖 API 与 GeckoLib，两者缺失都会在启动时报错。',
    badges: ['shota_partner', 'v0.3.1', 'geckolib 4.8.x'],
  },
  {
    step: '03',
    title: '（可选）放学校追加包',
    body: '想要学校维度再放入 ShotaPartner-Extra-School。它只依赖 API，不需要 GeckoLib，也不需要游戏本体，可以单独安装与升级。',
    badges: ['shota_partner_extra_school', 'v1.0.0'],
  },
]

/** 安装与前置 */
export function Install() {
  return (
    <Section id="install" className="border-t border-white/6">
      <SectionHeading
        eyebrow="Install"
        title={
          <>
            安装顺序与<span className="gradient-text">前置对照</span>
          </>
        }
        desc="拆分之后每个模块都是独立的 jar，前置关系写在 mods.toml 里：装错或缺前置时游戏会在启动阶段明确报错，而不是进游戏后才随机出问题。"
      />

      {/* 环境要求 */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {requirements.map((req, index) => (
          <Reveal key={req.label} delay={index * 50}>
            <div className="card card-hover h-full p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-violet-300">
                <Icon name={req.icon} className="h-4.5 w-4.5" />
              </span>
              <p className="mt-4 chip-mono uppercase tracking-[0.16em] text-slate-500">{req.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{req.value}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{req.note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* 步骤 */}
        <Reveal>
          <ol className="relative space-y-4">
            {steps.map((item) => (
              <li key={item.step} className="card card-hover relative flex gap-4 p-5 sm:p-6">
                <span className="chip-mono shrink-0 text-lg font-semibold text-white/25">{item.step}</span>
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {item.badges.map((badge) => (
                      <li key={badge} className="pill chip-mono text-[0.68rem] text-slate-300">
                        {badge}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* 依赖表 + 提示 */}
        <div className="space-y-4">
          <Reveal delay={60}>
            <div className="card overflow-hidden">
              <div className="border-b border-white/8 px-5 py-4">
                <h3 className="text-sm font-semibold text-white">前置声明（来自各模块 mods.toml）</h3>
              </div>
              <div className="divide-y divide-white/6">
                {modules.map((mod) => (
                  <div key={mod.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${mod.accent.dot}`} />
                      <span className="chip-mono text-xs text-slate-200">{mod.modId}</span>
                      <span className="chip-mono text-[0.68rem] text-slate-500">v{mod.version}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {mod.requires.map((dep) => (
                        <li key={dep} className="flex items-center gap-2 text-[0.78rem] text-slate-400">
                          <Icon name="check" className={`h-3 w-3 ${mod.accent.text}`} strokeWidth={2.6} />
                          {dep}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="card border-amber-400/20 bg-amber-500/6 p-5">
              <div className="flex items-start gap-3">
                <Icon name="info" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-300" />
                <div className="text-sm leading-relaxed text-slate-300">
                  <p className="font-medium text-white">从哪里获取？</p>
                  <p className="mt-1.5 text-slate-400">
                    三个模块仓库尚未公开，因此本页不提供指向仓库的下载跳转。请以官方发布帖或整合包内的版本为准；安装前请确认上表的版本与前置一致。
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <Icon name="scroll" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-violet-300" />
                <div className="text-sm leading-relaxed text-slate-400">
                  <p className="font-medium text-white">反馈时请顺手抄下版本号</p>
                  <p className="mt-1.5">
                    游戏内 Mods 列表里可以看到每个模块的 modId 与版本号。把它们填进反馈表单，可以省掉一轮来回确认。
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
