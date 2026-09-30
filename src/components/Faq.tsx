import { useMemo, useState } from 'react'
import { faqItems, type FaqItem } from '../data/faq'
import { DISCUSSIONS } from '../data/site'
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const tags: (FaqItem['tag'] | '全部')[] = ['全部', '安装', '模块', '兼容', '反馈']

/** 常见问题：带标签筛选的手风琴 */
export function Faq() {
  const [filter, setFilter] = useState<(typeof tags)[number]>('全部')
  const [open, setOpen] = useState<string | null>(faqItems[0]?.q ?? null)

  const list = useMemo(
    () => (filter === '全部' ? faqItems : faqItems.filter((item) => item.tag === filter)),
    [filter],
  )

  return (
    <Section id="faq" className="border-t border-white/6">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              安装与反馈的<span className="gradient-text">常见问题</span>
            </>
          }
          desc="这些是玩家问得最多、也最容易在 issue 里反复出现的问题。反馈之前先看一眼，能省下不少来回沟通。"
        />
        <Reveal>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilter(tag)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === tag
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white'
                    : 'border border-white/12 text-slate-400 hover:border-white/28 hover:text-slate-100'
                }`}
                aria-pressed={filter === tag}
              >
                {tag}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      <ul className="mt-10 space-y-3">
        {list.map((item, index) => {
          const isOpen = open === item.q
          return (
            <Reveal key={item.q} delay={Math.min(index, 6) * 40} as="li">
              <div className={`card overflow-hidden transition-colors ${isOpen ? 'border-white/16' : ''}`}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-start gap-3.5">
                    <span className="mt-0.5 pill chip-mono shrink-0 text-[0.68rem] text-slate-400">
                      {item.tag}
                    </span>
                    <span className={`text-sm font-medium sm:text-[0.95rem] ${isOpen ? 'text-white' : 'text-slate-200'}`}>
                      {item.q}
                    </span>
                  </span>
                  <Icon
                    name={isOpen ? 'minus' : 'plus'}
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                    strokeWidth={2.2}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400 sm:px-6 sm:pb-6 sm:pl-[5.6rem]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          )
        })}
      </ul>

      <Reveal className="mt-8">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="flex items-start gap-3 text-sm text-slate-400">
            <Icon name="book" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-cyan-300" />
            <span>上面的问答没有覆盖你的情况？支持类提问请走讨论区，可复现的问题与建议请提交 issue。</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={DISCUSSIONS}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/28 hover:text-white"
            >
              <Icon name="users" className="h-3.5 w-3.5" />
              讨论区提问
            </a>
            <a
              href="#feedback"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white"
            >
              <Icon name="bug" className="h-3.5 w-3.5" />
              提交问题反馈
            </a>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
