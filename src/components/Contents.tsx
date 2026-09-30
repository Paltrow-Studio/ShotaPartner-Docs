import type { Chapter } from '../data/types'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

/** 书页目录：点线 + 章节序号 */
export function Contents({ chapters, extra }: { chapters: Chapter[]; extra: { id: string; title: string }[] }) {
  return (
    <section id="contents" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-4 pb-2 sm:px-6">
      <Reveal>
        <Sheet className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-[1.1rem] font-semibold text-ink">目录</h2>
            <span className="num uppercase tracking-[0.18em] text-ink-faint">Contents</span>
          </div>
          <hr className="rule my-4" />
          <ol className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="toc-row text-[0.92rem]">
                <a href={`#${chapter.id}`} className="flex w-full items-baseline gap-2 text-ink-soft transition-colors hover:text-seal">
                  <span className="num shrink-0 text-ink-faint">{chapter.mark}</span>
                  <span className="shrink-0">{chapter.title}</span>
                  <span className="toc-dots" />
                </a>
              </li>
            ))}
            {extra.map((item) => (
              <li key={item.id} className="toc-row text-[0.92rem]">
                <a href={`#${item.id}`} className="flex w-full items-baseline gap-2 text-ink-soft transition-colors hover:text-seal">
                  <span className="num shrink-0 text-ink-faint">§</span>
                  <span className="shrink-0">{item.title}</span>
                  <span className="toc-dots" />
                </a>
              </li>
            ))}
          </ol>
        </Sheet>
      </Reveal>
    </section>
  )
}
