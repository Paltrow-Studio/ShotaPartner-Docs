import { featureCategories } from '../data/features'
import { moduleById } from '../data/modules'
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/** 玩法功能一览：按玩家可感知的维度分组 */
export function Features() {
  return (
    <Section id="features" className="border-t border-white/6">
      <SectionHeading
        eyebrow="Features"
        title={
          <>
            打开游戏之后，<span className="gradient-text">你实际能得到什么</span>
          </>
        }
        desc="下面按玩家能感知的维度整理，每一组都标注了它由哪个模块提供 —— 排查问题时可以先看这张图确认该去哪个模块下反馈。"
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {featureCategories.map((category, index) => {
          const mod = moduleById(category.owner)
          return (
            <Reveal key={category.id} delay={index * 50} as="article">
              <div className="card card-hover flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mod.accent.bg} ${mod.accent.text}`}
                    >
                      <Icon name={category.icon} className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white sm:text-lg">{category.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">{category.desc}</p>
                    </div>
                  </div>
                  <span className={`pill chip-mono shrink-0 ${mod.accent.text} ${mod.accent.border}`}>
                    {mod.shortName}
                  </span>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {category.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[0.84rem] leading-relaxed text-slate-300">
                      <Icon name="check" className={`mt-1 h-3.5 w-3.5 shrink-0 ${mod.accent.text}`} strokeWidth={2.4} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
