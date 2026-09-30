import type { Block, Chapter } from '../data/types'
import { RichText } from './paper'
import { Reveal } from './Reveal'

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className="text-[0.95rem] leading-[1.9] text-ink-soft">
          <RichText text={block.text} />
        </p>
      )

    case 'sub':
      return <h3 className="mt-2 text-[1.02rem] text-ink">{block.text}</h3>

    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[0.93rem] leading-[1.85] text-ink-soft">
              <span className="mt-[0.62em] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ul>
      )

    case 'steps':
      return (
        <ol className="space-y-3">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3 text-[0.93rem] leading-[1.85] text-ink-soft">
              <span className="num mt-[0.25em] shrink-0 text-seal">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ol>
      )

    case 'keys':
      return (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {block.items.map((item) => (
            <div key={item.key} className="flex items-baseline gap-3">
              <dt className="w-[5.5rem] shrink-0 text-right">
                <span className="key">{item.key}</span>
              </dt>
              <dd className="text-[0.9rem] text-ink-soft">
                <RichText text={item.desc} />
              </dd>
            </div>
          ))}
        </dl>
      )

    case 'table':
      return (
        <figure className="sheet overflow-hidden rounded-md">
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  {block.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.join('|')}>
                    {row.map((cell, i) => (
                      <td key={i} className={i === 0 ? 'text-ink' : undefined}>
                        <RichText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption ? (
            <figcaption className="border-t border-dashed border-line px-3 py-2 text-[0.8rem] text-ink-faint">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      )

    case 'note':
      return (
        <aside className="border-l-2 border-l-seal/60 bg-paper-sunk/70 py-3 pl-4 pr-3">
          <p className="text-[0.9rem] leading-[1.85] text-ink-soft">
            <span className="mr-1 text-seal">※</span>
            {block.title ? <strong className="mr-1 text-ink">{block.title}</strong> : null}
            <RichText text={block.text} />
          </p>
        </aside>
      )
  }
}

export function ChapterSection({ chapter }: { chapter: Chapter }) {
  return (
    <Reveal>
      <section id={chapter.id} className="scroll-mt-24 border-t border-dashed border-line pt-10">
        <header>
          <div className="flex items-center gap-3">
            <span className="chapter-mark">{chapter.mark}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <h2 className="mt-3 text-2xl sm:text-[1.7rem]">{chapter.title}</h2>
          <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">{chapter.lede}</p>
        </header>
        <div className="mt-6 space-y-5">
          {chapter.blocks.map((block, index) => (
            <BlockView key={index} block={block} />
          ))}
        </div>
      </section>
    </Reveal>
  )
}
