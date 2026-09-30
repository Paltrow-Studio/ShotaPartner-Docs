import { focusOf, partners, statLabels, statRatio } from '../data/roster'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

/** 可获得伙伴的名册：六项初始训练值 + 一句定位 */
export function Roster() {
  return (
    <section id="roster" className="scroll-mt-24">
      <Reveal>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-serif text-[1.1rem] font-semibold text-ink">
            名册：{partners.length} 位角色
          </h3>
          <p className="text-[0.82rem] text-ink-faint">
            数值是每位角色的初始训练值，六项总和都在 161~185 之间
          </p>
        </div>
      </Reveal>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner, index) => {
          const watcher = partner.id === 'xiaohei' || partner.id === 'xiaoluo'
          return (
            <Reveal key={partner.id} delay={Math.min(index, 8) * 20}>
              <Sheet hover className="h-full p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-[1.02rem] font-semibold text-ink">{partner.name}</p>
                  <span className="num text-[0.7rem] text-ink-faint">{partner.id}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="tag">{focusOf(partner)}</span>
                  {watcher ? <span className="tag tag-seal">看守者</span> : null}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {statLabels.map((stat, statIndex) => {
                    const value = partner.stats[statIndex]
                    return (
                      <div key={stat.key} className="flex items-center gap-2">
                        <dt className="w-[2.1rem] shrink-0 text-[0.76rem] text-ink-faint">{stat.label}</dt>
                        <span
                          aria-hidden="true"
                          className="h-[3px] flex-1 rounded-full bg-line"
                        >
                          <span
                            className="block h-full rounded-full bg-seal/70"
                            style={{ width: `${Math.round(statRatio(stat.key, value) * 100)}%` }}
                          />
                        </span>
                        <dd className="num w-[1.6rem] shrink-0 text-right text-[0.76rem] text-ink-soft">
                          {value}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </Sheet>
            </Reveal>
          )
        })}
      </div>

      <Reveal className="mt-4">
        <p className="text-[0.82rem] leading-relaxed text-ink-faint">
          显示用的四项基础数值（生命 20、攻击 2、防御 2、速度 0.25）在全部 {partners.length} 位角色上完全一致，
          实际差异体现在下表六项，每项上限 150。「看守者」表示该角色另有挂机刷新的野生入口。
        </p>
      </Reveal>
    </section>
  )
}
