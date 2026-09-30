import { useState } from 'react'
import { faqItems, type FaqItem } from '../data/faq'
import { DISCUSSIONS } from '../data/site'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

const tags: (FaqItem['tag'] | '全部')[] = ['全部', '玩法', '安装', '模块', '兼容', '反馈']

/** 常见问题：用原生 details，不依赖脚本也能展开 */
export function Faq() {
  const [filter, setFilter] = useState<(typeof tags)[number]>('全部')
  const list = filter === '全部' ? faqItems : faqItems.filter((item) => item.tag === filter)

  return (
    <section id="faq" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="chapter-mark">问答</span>
            <span className="h-px w-24 bg-line sm:w-40" />
          </div>
          <h2 className="mt-3 text-2xl sm:text-[1.7rem]">常被问到的几件事</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[0.82rem]">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter(tag)}
              aria-pressed={filter === tag}
              className={`rounded-md border px-2.5 py-1 transition-colors ${
                filter === tag
                  ? 'border-seal text-seal'
                  : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Reveal className="mt-6">
        <Sheet className="divide-y divide-dashed divide-line">
          {list.map((item) => (
            <details key={item.q} className="group px-5 py-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-start gap-3 py-4 text-[0.95rem] text-ink">
                <span className="tag mt-[0.15em] shrink-0">{item.tag}</span>
                <span className="flex-1">{item.q}</span>
                <span className="mt-[0.1em] shrink-0 text-ink-faint transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <p className="pb-5 pl-[3.4rem] pr-2 text-[0.9rem] leading-[1.9] text-ink-soft">{item.a}</p>
            </details>
          ))}
        </Sheet>
      </Reveal>

      <Reveal className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-l-line-strong bg-paper-sunk/60 py-3 pl-4 pr-4 text-[0.88rem] text-ink-soft">
          <p>上面没写到你的情况：怎么玩、怎么装这类问题请发讨论区；能复现的问题和建议提到 issue。</p>
          <div className="flex flex-wrap gap-x-5">
            <a href={DISCUSSIONS} target="_blank" rel="noreferrer noopener" className="link-quiet">
              讨论区
            </a>
            <a href="#feedback" className="link-quiet">
              去反馈区
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
