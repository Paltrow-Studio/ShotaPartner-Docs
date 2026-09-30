import { moduleSummaries } from '../data/modules'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

const requirements = [
  { label: 'Minecraft', value: '1.20.1', note: '只支持这一个版本' },
  { label: 'Forge', value: '47.x', note: '开发基准 47.4.23' },
  { label: 'Java', value: '17', note: 'JDK 21 会让 Forge 工具链出问题' },
  { label: 'GeckoLib', value: '4.8.x', note: '只有本体需要，学校包不用装' },
]

const steps = [
  '先放前置 `shota_partner_api`，再放本体 `shota_partner`。本体还依赖 GeckoLib 4.8.x，一起放进 mods。',
  '要玩学校就再放 `shota_partner_extra_school`。它不依赖本体，可以单独装、单独升级。',
  '进游戏后在 Mods 列表里确认三个 jar 的 modId 与版本，报问题时把这几行抄下来。',
]

export function Install() {
  return (
    <section id="install" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="chapter-mark">安装</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-3 text-2xl sm:text-[1.7rem]">装之前要确认的事</h2>
      <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
        前置关系写在每个 jar 自己的 mods.toml 里。缺前置或版本对不上时，游戏会在启动阶段直接报错，
        不会等到进存档才出问题。
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {requirements.map((item, index) => (
          <Reveal key={item.label} delay={index * 40}>
            <Sheet className="h-full p-4">
              <p className="num uppercase tracking-[0.14em] text-ink-faint">{item.label}</p>
              <p className="mt-1 font-serif text-[1.15rem] text-ink">{item.value}</p>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft">{item.note}</p>
            </Sheet>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div>
            <h3 className="text-[1rem] font-semibold text-ink">安装顺序</h3>
            <ol className="mt-3 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-[0.9rem] leading-relaxed text-ink-soft">
                  <span className="num mt-[0.25em] text-seal">{String(index + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-l-2 border-l-seal/60 bg-paper-sunk/70 py-3 pl-4 text-[0.86rem] leading-relaxed text-ink-soft">
              <span className="mr-1 text-seal">※</span>
              三个模组仓库还没公开，这一页不放下载跳转。请以官方发布帖或整合包里的版本为准，
              安装前对一下下面这张表里的版本。
            </p>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <Sheet className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>jar</th>
                    <th>版本</th>
                    <th>必需前置</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleSummaries.map((mod) => (
                    <tr key={mod.id}>
                      <td>
                        <code className="text-ink">{mod.modId}</code>
                        <span className="mt-1 block text-[0.8rem] text-ink-faint">{mod.role}</span>
                      </td>
                      <td className="num whitespace-nowrap">{mod.version}</td>
                      <td>
                        <ul className="space-y-1">
                          {mod.needs.map((need) => (
                            <li key={need} className="text-[0.84rem]">
                              {need}
                            </li>
                          ))}
                        </ul>
                        {mod.optional.length > 0 ? (
                          <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-faint">
                            可选联动：{mod.optional.join('、')}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-dashed border-line px-4 py-3 text-[0.82rem] leading-relaxed text-ink-soft">
              {moduleSummaries.find((m) => m.id === 'school')?.note}
            </p>
          </Sheet>
        </Reveal>
      </div>
    </section>
  )
}
