import { ORG, REPO } from '../data/site'
import { Sheet } from './paper'

const jars = [
  {
    id: 'shota_partner_api',
    role: '前置',
    note: '必须装。只提供接口，自己不含玩法内容。',
  },
  {
    id: 'shota_partner',
    role: '本体',
    note: '伙伴、技能、战斗、工作、方块物品都在这里。',
  },
  {
    id: 'shota_partner_extra_school',
    role: '可选',
    note: '学校维度。只依赖前置，可以单独装。',
  },
]

export function Hero() {
  return (
    <section id="overview" className="scroll-mt-24 pt-28 pb-14 sm:pt-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <p className="num uppercase tracking-[0.22em] text-ink-faint">Minecraft 1.20.1 · Forge 模组</p>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h1 className="font-serif text-[2.4rem] leading-[1.15] tracking-tight text-ink sm:text-[3.1rem]">
            伙伴物语
            <span className="mt-2 block font-mono text-[0.8rem] font-normal uppercase tracking-[0.28em] text-ink-faint">
              Partner Monogatari
            </span>
          </h1>
          <span className="seal mb-2 text-[0.82rem]">玩法说明</span>
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
          <div className="prose-paper max-w-2xl text-[0.98rem]">
            <p>
              这是一个 Minecraft 1.20.1 的 Forge 模组。野外会遇到没有主的伙伴：先把它打残，
              再用捕捉石收进队伍；也可以拿随机召唤石，从可选角色里直接抽一位。
            </p>
            <p>
              每位伙伴有一个专属技能、六个可以自由加点的成长项。它们能替你打架、帮你种地干活、
              里面有十二个住校的学生。
            </p>
            <p className="text-ink-faint">
              这一页是给玩家看的玩法说明。装之前先看下面的 jar 清单和安装要求，
              出了问题到页面最下面的反馈区提交。
            </p>
          </div>

          <Sheet className="p-5">
            <h2 className="text-[0.95rem] font-semibold text-ink">三个 jar，各装各的</h2>
            <hr className="rule my-3" />
            <ul className="space-y-3">
              {jars.map((jar) => (
                <li key={jar.id} className="text-[0.88rem] leading-relaxed">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <code className="text-ink">{jar.id}</code>
                    <span className="tag">{jar.role}</span>
                  </div>
                  <p className="mt-1 text-ink-soft">{jar.note}</p>
                </li>
              ))}
            </ul>
            <hr className="rule my-4" />
            <p className="text-[0.84rem] text-ink-soft">
              运行要求：Minecraft 1.20.1、Forge 47.x、Java 17。本体还需要{' '}
              <code>geckolib 4.8.x</code>，学校包不需要。
            </p>
          </Sheet>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.9rem]">
          <a href="#gameplay" className="link-quiet text-ink">
            读玩法说明 ↓
          </a>
          <a href="#install" className="link-quiet text-ink-soft">
            安装与前置
          </a>
          <a href="#feedback" className="link-quiet text-ink-soft">
            遇到问题，提交反馈
          </a>
          <a
            href={`https://github.com/${ORG}/${REPO}`}
            target="_blank"
            rel="noreferrer noopener"
            className="link-quiet text-ink-soft"
          >
            GitHub 仓库
          </a>
        </div>
      </div>
    </section>
  )
}
