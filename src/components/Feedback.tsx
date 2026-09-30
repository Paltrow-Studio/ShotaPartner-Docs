import { useMemo, useState } from 'react'
import {
  buildIssueUrl,
  issueTypes,
  moduleOptions,
  reportAntiPatterns,
  reportChecklist,
  type IssueTypeId,
} from '../data/feedback'
import { DISCUSSIONS, GITHUB_REPO, ISSUES } from '../data/site'
import type { ModuleId } from '../data/modules'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

export function Feedback() {
  const [typeId, setTypeId] = useState<IssueTypeId>('bug')
  const [moduleId, setModuleId] = useState<ModuleId | 'unknown'>('core')
  const [copied, setCopied] = useState(false)

  const type = useMemo(() => issueTypes.find((t) => t.id === typeId)!, [typeId])
  const option = useMemo(() => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3], [moduleId])
  const url = useMemo(() => buildIssueUrl(type, moduleId), [type, moduleId])
  const searchUrl = `${ISSUES}?q=${encodeURIComponent(
    `is:issue ${option.titleTag === '未确定' ? '' : option.titleTag}`.trim(),
  )}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section id="feedback" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="chapter-mark">反馈</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-3 text-2xl sm:text-[1.7rem]">遇到问题，在这里提</h2>
      <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
        三个模组仓库没有公开，所以玩家的反馈都提到这一页所在的仓库里，issue 区对所有人可见。
        下面选一下问题类型和涉及的模块，标题与标签会帮你填好，剩下在 GitHub 上提交即可。
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <Sheet className="p-5 sm:p-6">
            <p className="chapter-mark">一</p>
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">问题是哪一类</h3>
            <ul className="mt-3 divide-y divide-dashed divide-line border-y border-dashed border-line">
              {issueTypes.map((item) => {
                const selected = item.id === typeId
                return (
                  <li key={item.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 py-3 transition-colors ${
                        selected ? 'text-ink' : 'text-ink-soft'
                      }`}
                    >
                      <input
                        type="radio"
                        name="issue-type"
                        value={item.id}
                        checked={selected}
                        onChange={() => setTypeId(item.id)}
                        className="mt-[0.55em] h-3.5 w-3.5 shrink-0 accent-[var(--c-seal)]"
                      />
                      <span>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[0.95rem] font-medium">{item.name}</span>
                          <span className="num text-ink-faint">{item.when}</span>
                        </span>
                        <span className="mt-0.5 block text-[0.86rem] leading-relaxed text-ink-soft">
                          {item.desc}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <p className="chapter-mark mt-7">二</p>
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">出在哪个部分</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {moduleOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModuleId(item.id)}
                  aria-pressed={item.id === moduleId}
                  className={`rounded-md border px-3 py-1.5 text-[0.85rem] transition-colors ${
                    item.id === moduleId
                      ? 'border-seal bg-paper-sunk text-seal'
                      : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="chapter-mark mt-7">三</p>
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">打开表单</h3>
            <div className="mt-3 rounded-md border border-dashed border-line bg-paper-sunk/60 p-4">
              <dl className="space-y-2 text-[0.85rem]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="num w-20 shrink-0 text-ink-faint">模板</dt>
                  <dd>
                    <code>{type.template}</code>
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="num w-20 shrink-0 text-ink-faint">标题</dt>
                  <dd>
                    <code>{`${type.titlePrefix} [${option.titleTag}] …`}</code>
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="num w-20 shrink-0 text-ink-faint">标签</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {type.labels.split(',').map((label) => (
                      <span key={label} className="tag">
                        {label}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-dashed border-line pt-3 text-[0.82rem] text-ink-faint">
                打开表单后，把「涉及模块」这一项选成「{option.formOption}」，其余必填项按提示补齐。
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.88rem]">
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-seal px-4 py-2 text-seal transition-colors hover:bg-paper-sunk"
              >
                在 GitHub 打开表单 →
              </a>
              <button type="button" onClick={copy} className="link-quiet text-ink-soft">
                {copied ? '已复制链接' : '复制表单链接'}
              </button>
              <a
                href={searchUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="link-quiet text-ink-soft"
              >
                先搜同类 issue
              </a>
            </div>

            <p className="mt-4 text-[0.8rem] text-ink-faint">
              提交需要 GitHub 账号。不方便注册的话，也可以在官方发布帖或玩家群里反馈。
            </p>
          </Sheet>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={60}>
            <Sheet className="p-5 sm:p-6">
              <h3 className="text-[1rem] font-semibold text-ink">提之前先准备</h3>
              <ol className="mt-3 space-y-3">
                {reportChecklist.map((item, index) => (
                  <li key={item.title} className="flex gap-3 text-[0.88rem]">
                    <span className="num mt-[0.15em] text-seal">{String(index + 1).padStart(2, '0')}</span>
                    <span>
                      <span className="block text-ink">{item.title}</span>
                      <span className="mt-0.5 block leading-relaxed text-ink-soft">{item.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Sheet>
          </Reveal>

          <Reveal delay={110}>
            <Sheet className="p-5 sm:p-6">
              <h3 className="text-[1rem] font-semibold text-ink">这几种情况会被直接关掉</h3>
              <ul className="mt-3 space-y-2">
                {reportAntiPatterns.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[0.88rem] leading-relaxed text-ink-soft">
                    <span className="text-seal">×</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Sheet>
          </Reveal>

          <Reveal delay={150}>
            <Sheet className="p-5 sm:p-6">
              <h3 className="text-[1rem] font-semibold text-ink">直达</h3>
              <ul className="mt-3 space-y-1.5 text-[0.88rem]">
                {issueTypes.map((item) => (
                  <li key={item.id}>
                    <a
                      href={buildIssueUrl(item, moduleId)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-quiet inline-block py-0.5 text-ink-soft"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
                <li className="pt-1">
                  <a href={ISSUES} target="_blank" rel="noreferrer noopener" className="link-quiet text-ink-soft">
                    浏览全部 issue
                  </a>
                </li>
                <li>
                  <a
                    href={DISCUSSIONS}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet text-ink-soft"
                  >
                    讨论区（提问、闲聊）
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_REPO}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet text-ink-soft"
                  >
                    本仓库首页
                  </a>
                </li>
              </ul>
            </Sheet>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
