import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildIssueUrl,
  buildReportDraft,
  buildReportText,
  issueTypes,
  moduleOptions,
  reportAntiPatterns,
  reportChecklist,
  type IssueTypeId,
} from '../data/feedback'
import {
  DISCUSSIONS,
  FALLBACK_FEEDBACK_LABEL,
  FALLBACK_FEEDBACK_URL,
  FEEDBACK_RELAY_URL,
  GITHUB_REPO,
  ISSUES,
  REPO_ARCHIVE,
  REPO_README_RAW,
  SITE_MIRROR_URL,
} from '../data/site'
import { accelerated, useAccelerator } from '../lib/accelerator'
import { useRelay } from '../lib/relay'
import { useGithubReach } from '../lib/reach'
import type { ModuleId } from '../data/modules'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

const reachText: Record<string, string> = {
  idle: '尚未检测 GitHub 连接。',
  checking: '正在检测 GitHub 连接，最长等待 6 秒…',
  ok: 'GitHub 可正常访问，可直接打开表单提交。',
  blocked: '无法连接 github.com（被拦截或超时）。',
}

const nodeText: Record<string, string> = {
  checking: '计时中',
  ok: '可用',
  fail: '不可用',
}

export function Feedback() {
  const [typeId, setTypeId] = useState<IssueTypeId>('bug')
  const [moduleId, setModuleId] = useState<ModuleId | 'unknown'>('core')
  const [copied, setCopied] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'manual'>('idle')
  const [downloaded, setDownloaded] = useState(false)
  const [summary, setSummary] = useState('')
  const [contact, setContact] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [issueUrl, setIssueUrl] = useState('')
  const sectionRef = useRef<HTMLElement | null>(null)
  const manualRef = useRef<HTMLTextAreaElement | null>(null)
  const { state: reach, check: checkReach } = useGithubReach()
  const { rows: nodes, phase: nodePhase, best: bestNode, check: checkNodes } = useAccelerator()
  const {
    health: relayHealth,
    latency: relayLatency,
    submitting: relaySubmitting,
    check: checkRelay,
    submit: submitRelay,
  } = useRelay(FEEDBACK_RELAY_URL)
  const submitBusy = relaySubmitting

  const type = useMemo(() => issueTypes.find((t) => t.id === typeId)!, [typeId])
  const option = useMemo(() => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3], [moduleId])
  const url = useMemo(() => buildIssueUrl(type, moduleId), [type, moduleId])
  const searchUrl = `${ISSUES}?q=${encodeURIComponent(
    `is:issue ${option.titleTag === '未确定' ? '' : option.titleTag}`.trim(),
  )}`

  // 反馈区进入视口后再探测，避免每次进页面都发出跨站请求
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      void checkReach()
      void checkNodes()
      void checkRelay()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void checkReach()
          void checkNodes()
          void checkRelay()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkReach, checkNodes, checkRelay])

  const copyReport = async () => {
    const text = buildReportText(type, moduleId)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('ok')
      window.setTimeout(() => setCopyState('idle'), 2400)
    } catch {
      setCopyState('manual')
      window.setTimeout(() => {
        manualRef.current?.focus()
        manualRef.current?.select()
      }, 0)
    }
  }

  const downloadReport = () => {
    const text = buildReportText(type, moduleId)
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `伙伴物语-反馈-${type.id}-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    window.setTimeout(() => setDownloaded(false), 2400)
  }

  const submitByRelay = async () => {
    setSubmitState('idle')
    setSubmitMessage('')
    // 标题与正文沿用与表单深链完全相同的草稿，两处内容不会各说各话
    const draft = buildReportDraft(type, moduleId)
    const result = await submitRelay({
      type: typeId,
      module: moduleId,
      summary: summary.trim(),
      body: draft.body,
      contact: contact.trim(),
      titlePrefix: type.titlePrefix,
      moduleTag: option.titleTag,
      honeypot,
    })
    if (result.ok) {
      setSubmitState('ok')
      setIssueUrl(result.url)
    } else {
      setSubmitState('error')
      setSubmitMessage(result.error)
    }
  }

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
    <section
      id="feedback"
      ref={sectionRef}
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6"
    >
      <div className="flex items-center gap-3">
        <span className="chapter-mark">反馈</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-3 text-2xl sm:text-[1.7rem]">问题反馈</h2>
      <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
        三个模组仓库未公开，玩家反馈统一提交至本页所在仓库，issue 区对所有人可见。
        在下方选择问题类型与涉及的模块，表单的标题与标签会自动预填，其余内容在 GitHub 上补齐后提交。
      </p>

      <Reveal className="mt-6">
        <Sheet className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="text-[1rem] font-semibold text-ink">连接检测与反馈内容生成</h3>
            <div className="flex flex-wrap items-baseline gap-3 text-[0.82rem] text-ink-soft">
              <span
                role="status"
                aria-live="polite"
                className={reach === 'blocked' ? 'text-seal' : undefined}
              >
                {reachText[reach]}
              </span>
              <button
                type="button"
                onClick={() => {
                  void checkReach()
                  void checkNodes()
                }}
                className="link-quiet text-ink-soft"
              >
                重新检测
              </button>
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-line pt-3 text-[0.84rem] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">资源线路自动测试</span>
              {nodePhase === 'idle' ? '：本区进入视口后自动开始。' : null}
              {nodePhase === 'testing'
                ? '：正在用你当前的网络逐个节点下载同一个文件并计时，单节点最长 8 秒。'
                : null}
              {nodePhase === 'done' && bestNode
                ? `：实测最快为 ${bestNode.label}（${bestNode.ms} ms），已自动用于下面的资源链接。`
                : null}
              {nodePhase === 'done' && !bestNode ? '：全部节点不可用，资源链接保持直连。' : null}
            </p>
            {nodePhase === 'done' ? (
              <>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem]">
                  {nodes.map((node) => (
                    <li key={node.id} className={node.state === 'ok' ? 'text-ink' : 'text-ink-faint'}>
                      {node.state === 'ok'
                        ? `${node.label} ${node.ms} ms`
                        : `${node.label} ${nodeText[node.state]}${node.note ? `（${node.note}）` : ''}`}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  节点只转发 raw、archive 与 release 一类文件路径。仓库页、issue 页与登录页属于
                  HTML 页面，节点一律返回 403 或 404，因此
                  <span className="text-ink">表单提交无法经节点完成</span>。
                </p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <a
                    href={accelerated(bestNode?.prefix ?? '', REPO_ARCHIVE)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet"
                  >
                    下载本站源码 zip
                  </a>
                  <a
                    href={accelerated(bestNode?.prefix ?? '', REPO_README_RAW)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet"
                  >
                    查看 README（raw）
                  </a>
                  <span className="text-ink-faint">当前线路：{bestNode ? bestNode.label : '直连'}</span>
                </p>
              </>
            ) : null}
          </div>

          {FEEDBACK_RELAY_URL ? (
            <div className="mt-4 border-t border-dashed border-line pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h4 className="text-[0.92rem] font-semibold text-ink">经中继直接提交</h4>
                <span className="text-[0.82rem] text-ink-soft">
                  {relayHealth === 'checking' ? '正在检测中继…' : null}
                  {relayHealth === 'ok' ? `中继可用（${relayLatency} ms）` : null}
                  {relayHealth === 'fail' ? '中继不可用，请改用复制或下载。' : null}
                  {relayHealth === 'idle' ? '尚未检测中继。' : null}
                </span>
              </div>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-soft">
                提交后由维护者的中继调用 GitHub API 建 issue，浏览器不需要能打开 github.com。
                令牌只保存在中继上。标题由问题类型、涉及模块与下面这句概述拼成。
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                <label className="text-[0.84rem] text-ink-soft">
                  问题概述（会写进标题）
                  <input
                    type="text"
                    value={summary}
                    maxLength={120}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="例如：伙伴在工作时不会拾取掉落物"
                    className="mt-1 w-full rounded-md border border-line bg-paper-sunk/50 px-3 py-2 text-[0.88rem] text-ink"
                  />
                </label>
                <label className="text-[0.84rem] text-ink-soft">
                  联系方式（可选，方便追问）
                  <input
                    type="text"
                    value={contact}
                    maxLength={120}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="QQ / 邮箱 / 论坛 ID"
                    className="mt-1 w-full rounded-md border border-line bg-paper-sunk/50 px-3 py-2 text-[0.88rem] text-ink"
                  />
                </label>
              </div>
              {/* 蜜罐：正常用户看不见，只有脚本会填 */}
              <input
                type="text"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[0.86rem]">
                <button
                  type="button"
                  disabled={submitBusy || summary.trim().length < 4}
                  onClick={() => void submitByRelay()}
                  className="rounded-md border border-seal px-4 py-2 text-seal transition-colors hover:bg-paper-sunk disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint"
                >
                  {submitBusy ? '正在提交…' : '直接提交到 issue 区'}
                </button>
                {submitState === 'ok' && issueUrl ? (
                  <span role="status" aria-live="polite">
                    已创建：
                    <a href={issueUrl} target="_blank" rel="noreferrer noopener" className="link-quiet ml-1">
                      {issueUrl.replace('https://github.com/', '')}
                    </a>
                  </span>
                ) : null}
                {submitState === 'error' ? (
                  <span role="status" aria-live="polite" className="text-seal">
                    提交失败：{submitMessage}
                  </span>
                ) : null}
                {submitState === 'idle' && summary.trim().length < 4 ? (
                  <span className="text-ink-faint">填写问题概述后即可提交。</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <hr className="rule my-3" />
          <p className="text-[0.86rem] leading-relaxed text-ink-soft">
            下列内容与表单字段一一对应，可直接粘进表单；GitHub 无法打开时，也可复制或下载后发送给维护者。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.88rem]">
            <button
              type="button"
              onClick={() => void copyReport()}
              className="rounded-md border border-seal px-4 py-2 text-seal transition-colors hover:bg-paper-sunk"
            >
              {copyState === 'ok' ? '已复制完整反馈内容' : '复制完整反馈内容'}
            </button>
            <button type="button" onClick={downloadReport} className="link-quiet text-ink-soft">
              {downloaded ? '已下载 .md 文件' : '下载为 .md 文件'}
            </button>
            {FALLBACK_FEEDBACK_URL ? (
              <a
                href={FALLBACK_FEEDBACK_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="link-quiet text-ink-soft"
              >
                {FALLBACK_FEEDBACK_LABEL}
              </a>
            ) : null}
            {SITE_MIRROR_URL ? (
              <a href={SITE_MIRROR_URL} className="link-quiet text-ink-soft">
                本站国内镜像
              </a>
            ) : null}
          </div>

          {copyState === 'manual' ? (
            <div className="mt-3">
              <p className="text-[0.82rem] text-ink-soft">
                浏览器拦截了自动复制，请在下方全选复制：
              </p>
              <textarea
                ref={manualRef}
                readOnly
                value={buildReportText(type, moduleId)}
                className="mt-2 h-40 w-full resize-y rounded-md border border-line bg-paper-sunk/60 p-3 font-mono text-[0.78rem] leading-relaxed text-ink"
              />
            </div>
          ) : null}

          {reach === 'blocked' ? (
            <div className="mt-4 border-l-2 border-l-seal/60 bg-paper-sunk/70 py-3 pl-4 pr-3 text-[0.86rem] leading-relaxed text-ink-soft">
              <p>
                当前网络无法打开 github.com，而 issue 表单需要在 github.com 登录后填写。上面的自动测试已按你的
                网络挑出可用的资源线路，但资源线路无法承载表单与登录页。请先复制或下载反馈内容，再通过可用的
                网络环境、官方发布帖或玩家群提交。
              </p>
            </div>
          ) : null}
        </Sheet>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <Sheet className="p-5 sm:p-6">
            <p className="chapter-mark">一</p>
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">问题类型</h3>
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
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">涉及模块</h3>
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
            <h3 className="mt-1 text-[1rem] font-semibold text-ink">表单预填内容</h3>
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
                打开表单后，将「涉及模块」一项选为「{option.formOption}」，其余必填项按提示补齐。
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
                搜索同类 issue
              </a>
            </div>

            <p className="mt-4 text-[0.8rem] text-ink-faint">
              提交需要 GitHub 账号。无法注册账号时，也可通过官方发布帖或玩家群反馈。
            </p>
          </Sheet>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={60}>
            <Sheet className="p-5 sm:p-6">
              <h3 className="text-[1rem] font-semibold text-ink">提交前需准备的信息</h3>
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
              <h3 className="text-[1rem] font-semibold text-ink">不予受理的情况</h3>
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
              <h3 className="text-[1rem] font-semibold text-ink">直达链接</h3>
              <ul className="mt-3 space-y-1.5 text-[0.88rem]">
                {issueTypes.map((item) => (
                  <li key={item.id}>
                    <a
                      href={buildIssueUrl(item, moduleId)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-quiet inline-block py-1 text-ink-soft"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
                <li className="pt-1">
                  <a
                    href={ISSUES}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet inline-block py-1 text-ink-soft"
                  >
                    浏览全部 issue
                  </a>
                </li>
                <li>
                  <a
                    href={DISCUSSIONS}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet inline-block py-1 text-ink-soft"
                  >
                    讨论区（提问与交流）
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_REPO}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet inline-block py-1 text-ink-soft"
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
