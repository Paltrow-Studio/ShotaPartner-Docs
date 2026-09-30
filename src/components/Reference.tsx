import {
  blockNote,
  blockRows,
  effectRows,
  itemNote,
  itemRows,
  keybindRows,
  recipeNote,
  recipeRows,
} from '../data/reference'
import { Sheet } from './paper'
import { RichText } from './paper'
import { Reveal } from './Reveal'

function Ledger({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Sheet className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td key={index} className={index === 0 ? 'text-ink' : undefined}>
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  )
}

export function Reference() {
  return (
    <section id="reference" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="chapter-mark">速查</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-3 text-2xl sm:text-[1.7rem]">按键与物品</h2>
      <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
        玩之前先记这四个键就够了。下面是合成、物品、方块与状态效果的速查。
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div>
            <h3 className="text-[1rem] font-semibold text-ink">按键</h3>
            <dl className="mt-3 space-y-2">
              {keybindRows.map((item) => (
                <div key={item.key} className="flex items-baseline gap-3">
                  <dt className="w-[5.5rem] shrink-0 text-right">
                    <span className="key">{item.key}</span>
                  </dt>
                  <dd className="text-[0.88rem] text-ink-soft">{item.desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div>
            <h3 className="text-[1rem] font-semibold text-ink">状态效果</h3>
            <Ledger head={['效果', '类别', '说明']} rows={effectRows} />
          </div>
        </Reveal>
      </div>

      <Reveal className="mt-8">
        <h3 className="text-[1rem] font-semibold text-ink">合成</h3>
        <div className="mt-3">
          <Ledger head={['产物', '配方', '说明']} rows={recipeRows} />
        </div>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-faint">
          <RichText text={recipeNote} />
        </p>
      </Reveal>

      <Reveal className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[1rem] font-semibold text-ink">物品</h3>
          <div className="mt-3">
            <Ledger head={['物品', '用途']} rows={itemRows} />
          </div>
          <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-faint">
            <RichText text={itemNote} />
          </p>
        </div>

        <div>
          <h3 className="text-[1rem] font-semibold text-ink">方块</h3>
          <div className="mt-3">
            <Ledger head={['方块', '用途']} rows={blockRows} />
          </div>
          <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-faint">
            <RichText text={blockNote} />
          </p>
        </div>
      </Reveal>
    </section>
  )
}
