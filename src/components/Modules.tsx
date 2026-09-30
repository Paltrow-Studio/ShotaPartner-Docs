import { useState } from 'react'
import { modules, type ModuleInfo } from '../data/modules'
import { buildIssueUrl, issueTypes } from '../data/feedback'
import { GITHUB_REPO } from '../data/site'
import { Icon } from './Icons'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const iconForModule = (id: ModuleInfo['id']) => (id === 'api' ? 'branch' : id === 'core' ? 'cube' : 'map')
const PREVIEW_COUNT = 6

function ModuleCard({ mod, index }: { mod: ModuleInfo; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const hiddenCount = mod.highlights.length - PREVIEW_COUNT
  const shown = expanded ? mod.highlights : mod.highlights.slice(0, PREVIEW_COUNT)
  const bugType = issueTypes.find((t) => t.id === 'bug')!

  return (
    <Reveal delay={index * 70} as="article">
      <div id={`module-${mod.id}`} className={`card card-hover scroll-mt-28 overflow-hidden`}>
        {/* 顶部渐变条 */}
        <div className={`h-1 w-full bg-gradient-to-r ${mod.accent.gradient}`} />

        <div className="p-6 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${mod.accent.gradient} text-white shadow-lg ${mod.accent.glow}`}
              >
                <Icon name={iconForModule(mod.id)} className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white sm:text-2xl">{mod.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`pill chip-mono ${mod.accent.text} ${mod.accent.border}`}>
                    modId: {mod.modId}
                  </span>
                  <span className="pill chip-mono">v{mod.version}</span>
                  <span className="pill text-[0.7rem] text-slate-400">{mod.side}</span>
                </div>
              </div>
            </div>
            <span className={`pill ${mod.accent.bg} ${mod.accent.border} ${mod.accent.text} text-[0.72rem]`}>
              {mod.badge}
            </span>
          </header>

          <p className="mt-5 text-sm leading-relaxed text-slate-300 sm:text-[0.95rem]">{mod.summary}</p>

          {/* 指标 */}
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {mod.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <dt className={`text-lg font-semibold ${mod.accent.text}`}>{metric.value}</dt>
                <dd className="mt-0.5 text-[0.7rem] leading-snug text-slate-400">{metric.label}</dd>
              </div>
            ))}
          </dl>

          {/* 功能亮点 */}
          <ul className="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {shown.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${mod.accent.dot}`} />
                <span>
                  <span className="block text-sm font-medium text-slate-100">{item.title}</span>
                  <span className="mt-1 block text-[0.82rem] leading-relaxed text-slate-400">{item.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/28 hover:text-white"
              aria-expanded={expanded}
            >
              <Icon name={expanded ? 'minus' : 'plus'} className="h-3.5 w-3.5" strokeWidth={2.2} />
              {expanded ? '收起' : `展开其余 ${hiddenCount} 项`}
            </button>
          ) : null}

          {/* 依赖 */}
          <div className="mt-7 grid gap-4 border-t border-white/8 pt-6 sm:grid-cols-2">
            <div>
              <p className="chip-mono uppercase tracking-[0.16em] text-slate-500">必需前置</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {mod.requires.map((dep) => (
                  <li key={dep} className="pill border-emerald-400/20 bg-emerald-500/8 text-emerald-200">
                    <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                    {dep}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="chip-mono uppercase tracking-[0.16em] text-slate-500">
                可选联动 {mod.optional.length > 0 ? `(${mod.optional.length})` : ''}
              </p>
              {mod.optional.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {mod.optional.map((dep) => (
                    <li key={dep} className="pill chip-mono text-[0.68rem] text-slate-400">
                      {dep}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  不依赖任何第三方模组 —— 这是刻意保持的约束，避免下游拿到未 deobf 的坐标。
                </p>
              )}
            </div>
          </div>

          {/* 操作 */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={buildIssueUrl(bugType, mod.id)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/4 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/28 hover:text-white"
            >
              <Icon name="bug" className="h-3.5 w-3.5" />
              报告此模块的问题
            </a>
            <span className="chip-mono text-[0.68rem] text-slate-500">
              提交时会把「{mod.shortName}」预填进标题与标签
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

/** 三个模块的详细介绍 */
export function Modules() {
  return (
    <Section id="modules" className="border-t border-white/6">
      <SectionHeading
        eyebrow="Three Modules"
        title={
          <>
            三个仓库，<span className="gradient-text">各管一件事</span>
          </>
        }
        desc="游戏本体负责内容，公共前置负责契约，学校追加包负责一个可选场景。下面每一项都来自各仓库的 README 与源码结构，改版本时会同步更新。"
      />

      <div className="mt-12 space-y-8">
        {modules.map((mod, index) => (
          <ModuleCard key={mod.id} mod={mod} index={index} />
        ))}
      </div>

      <Reveal className="mt-8">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="flex items-start gap-3 text-sm text-slate-400">
            <Icon name="info" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-cyan-300" />
            <span>
              三个模块仓库暂时没有公开源码。开发计划、拆分清单与覆盖率报告都在仓库内部维护；对外只需要看这一页就够了。
            </span>
          </p>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/28 hover:text-white"
          >
            <Icon name="github" className="h-4 w-4" />
            本仓库（文档与反馈）
          </a>
        </div>
      </Reveal>
    </Section>
  )
}
