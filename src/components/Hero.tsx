import { ORG, REPO } from '../data/site'
import { Sheet } from './paper'

const jars = [
  {
    id: 'shota_partner_api',
    role: '前置',
    note: '必需。仅提供接口与扩展点，不含玩法内容。',
  },
  {
    id: 'shota_partner',
    role: '本体',
    note: '伙伴、技能、战斗、工作、方块与物品均在此。',
  },
  {
    id: 'shota_partner_extra_school',
    role: '可选',
    note: '学校维度。仅依赖前置 API，可单独安装。',
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
              本页为 Minecraft 1.20.1 Forge 模组《伙伴物语》的玩法说明。野外出现的伙伴多为无主实体，
              需先压低其血量，再用捕捉石收进队伍；也可通过随机召唤石从可选角色中直接抽取一位。
            </p>
            <p>
              每位伙伴拥有一个专属技能与六项可自由分配的成长值，可承担战斗、农作与搬运等工作；
              阵亡后会留下墓碑，可通过多种方式复活。安装学校追加包后还可进入学校维度，其中共有十二位学生。
            </p>
            <p className="text-ink-faint">
              本页内容以源码为准。安装前请先查看下方 jar 清单与运行要求；如遇问题，可通过页面底部的反馈区提交。
            </p>
          </div>

          <Sheet className="p-5">
            <h2 className="text-[0.95rem] font-semibold text-ink">三个 jar 的安装关系</h2>
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
              运行要求：Minecraft 1.20.1、Forge 47.x、Java 17。本体另需{' '}
              <code>geckolib 4.8.x</code>，学校包不需要。
            </p>
          </Sheet>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.9rem]">
          <a href="#gameplay" className="link-quiet text-ink">
            玩法说明 ↓
          </a>
          <a href="#install" className="link-quiet text-ink-soft">
            安装与前置
          </a>
          <a href="#feedback" className="link-quiet text-ink-soft">
            问题反馈
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
