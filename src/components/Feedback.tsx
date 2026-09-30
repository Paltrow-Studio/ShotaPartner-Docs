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
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * 公开问题反馈区。
 * 纯静态站点没有后端 token，因此走 GitHub 官方的 issue 表单深链：
 * 页面负责把「问题类型 + 涉及模块」翻译成预填好的标题与标签，玩家在 GitHub 完成提交。
 */
export function Feedback() {
  const [typeId, setTypeId] = useState<IssueTypeId>('bug')
  const [moduleId, setModuleId] = useState<ModuleId | 'unknown'>('core')
  const [copied, setCopied] = useState(false)

  const type = useMemo(() => issueTypes.find((t) => t.id === typeId)!, [typeId])
  const option = useMemo(
    () => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3],
    [moduleId],
  )
  const url = useMemo(() => buildIssueUrl(type, moduleId), [type, moduleId])
  const previewTitle = `${type.titlePrefix} [${option.titleTag}] …`
  const searchUrl = `${ISSUES}?q=${encodeURIComponent(
    `is:issue ${option.titleTag === '未确定' ? '' : option.titleTag} ${type.name}`.trim(),
  )}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Section id="feedback" className="border-t border-white/6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-10 h-[26rem] w-[46rem] -translate-x-1/2 rounded-full bg-violet-600/12 blur-[140px]" />
      </div>

      <SectionHeading
        eyebrow="Feedback"
        title={
          <>
            公开的<span className="gradient-text">问题反馈区</span>
          </>
        }
        desc="三个模块仓库目前没有公开，所以玩家的反馈统一提交到本仓库的 issue 区 —— 它对所有人开放。下面的三步会帮你把问题类型和涉及模块预填进表单，提交后维护者能直接分流。"
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* 交互构建器 */}
        <Reveal>
          <div className="card p-6 sm:p-7">
            {/* 步骤 1 */}
            <div className="flex items-center gap-3">
              <span className="chip-mono flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 text-xs text-slate-300">
                1
              </span>
              <h3 className="text-sm font-semibold text-white">你想反馈什么？</h3>
            </div>
            <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
              {issueTypes.map((item) => {
                const selected = item.id === typeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTypeId(item.id)}
                    aria-pressed={selected}
                    className={`card card-hover flex h-full flex-col items-start gap-2 p-4 text-left transition-colors ${
                      selected ? `${item.accent.border} ${item.accent.bg}` : 'border-white/8'
                    }`}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className={`flex items-center gap-2 text-sm font-semibold ${selected ? 'text-white' : 'text-slate-200'}`}>
                        <Icon name={item.icon} className={`h-4 w-4 ${item.accent.text}`} />
                        {item.name}
                      </span>
                      <span
                        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-transparent bg-gradient-to-br from-violet-500 to-cyan-500' : 'border-white/25'
                        }`}
                      >
                        {selected ? <Icon name="check" className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
                      </span>
                    </span>
                    <span className="text-xs leading-relaxed text-slate-400">{item.desc}</span>
                    <span className={`chip-mono mt-auto pt-2 text-[0.68rem] ${item.accent.text}`}>
                      {item.when}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 步骤 2 */}
            <div className="mt-8 flex items-center gap-3">
              <span className="chip-mono flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 text-xs text-slate-300">
                2
              </span>
              <h3 className="text-sm font-semibold text-white">涉及哪个模块？</h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {moduleOptions.map((item) => {
                const selected = item.id === moduleId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModuleId(item.id)}
                    aria-pressed={selected}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-white/12 text-white'
                        : 'border border-white/12 text-slate-400 hover:border-white/28 hover:text-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* 步骤 3 */}
            <div className="mt-8 flex items-center gap-3">
              <span className="chip-mono flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 text-xs text-slate-300">
                3
              </span>
              <h3 className="text-sm font-semibold text-white">确认并打开表单</h3>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <dl className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="chip-mono w-20 shrink-0 text-slate-400">表单模板</dt>
                  <dd className="chip-mono text-slate-200">{type.template}</dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="chip-mono w-20 shrink-0 text-slate-400">预填标题</dt>
                  <dd className="chip-mono text-slate-200">{previewTitle}</dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="chip-mono w-20 shrink-0 text-slate-400">自动标签</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {type.labels.split(',').map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.68rem] text-slate-300"
                      >
                        {label}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-white/8 pt-3 text-[0.72rem] leading-relaxed text-slate-400">
                打开表单后请把「涉及模块」选为「{option.formOption}」。表单的必填项会提示你补齐版本、日志与复现步骤。
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-transform hover:-translate-y-0.5"
              >
                <Icon name="github" className="h-4 w-4" />
                在 GitHub 打开表单
                <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/28 hover:text-white"
              >
                <Icon name={copied ? 'check' : 'scroll'} className="h-3.5 w-3.5" />
                {copied ? '已复制链接' : '复制表单链接'}
              </button>
              <a
                href={searchUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/28 hover:text-white"
              >
                <Icon name="list" className="h-3.5 w-3.5" />
                先搜索同类 issue
              </a>
            </div>

            <p className="mt-4 text-[0.72rem] leading-relaxed text-slate-400">
              提交需要 GitHub 账号；issue 是公开的，所有人都能查看与跟进。若你不方便注册账号，也可以在官方发布帖或玩家群里反馈。
            </p>
          </div>
        </Reveal>

        {/* 右侧：提交清单 + 注意事项 */}
        <div className="space-y-6">
          <Reveal delay={60}>
            <div className="card p-6 sm:p-7">
              <h3 className="flex items-center gap-2.5 text-sm font-semibold text-white">
                <Icon name="package" className="h-4.5 w-4.5 text-violet-300" />
                提交前请准备好
              </h3>
              <ul className="mt-5 space-y-4">
                {reportChecklist.map((item) => (
                  <li key={item.title} className="flex gap-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6 text-slate-300">
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-100">{item.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">{item.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <div className="card border-rose-400/20 bg-rose-500/6 p-6 sm:p-7">
              <h3 className="flex items-center gap-2.5 text-sm font-semibold text-white">
                <Icon name="alert" className="h-4.5 w-4.5 text-rose-300" />
                请不要这样做
              </h3>
              <ul className="mt-4 space-y-2.5">
                {reportAntiPatterns.map((item) => (
                  <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-slate-300">
                    <Icon name="close" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" strokeWidth={2.4} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-white">直达链接</h3>
              <ul className="mt-4 space-y-2.5">
                {issueTypes.map((item) => (
                  <li key={item.id}>
                    <a
                      href={buildIssueUrl(item, moduleId)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-underline flex items-center justify-between gap-3 py-1 text-xs text-slate-300 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <Icon name={item.icon} className={`h-3.5 w-3.5 ${item.accent.text}`} />
                        {item.name}
                      </span>
                      <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                  </li>
                ))}
                <li className="pt-1.5">
                  <a
                    href={ISSUES}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-underline flex items-center justify-between gap-3 py-1 text-xs text-slate-300 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="list" className="h-3.5 w-3.5 text-slate-400" />
                      浏览全部 issue
                    </span>
                    <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
                <li>
                  <a
                    href={DISCUSSIONS}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-underline flex items-center justify-between gap-3 py-1 text-xs text-slate-300 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="users" className="h-3.5 w-3.5 text-slate-400" />
                      讨论区（提问 / 交流）
                    </span>
                    <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_REPO}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-underline flex items-center justify-between gap-3 py-1 text-xs text-slate-300 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="github" className="h-3.5 w-3.5 text-slate-400" />
                      本仓库首页
                    </span>
                    <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
