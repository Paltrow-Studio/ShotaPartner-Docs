import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildIssueUrl,
  buildReportDraft,
  formFieldList,
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
  SITE_MIRROR_URL,
} from '../data/site'
import { useRelay } from '../lib/relay'
import type { ModuleId } from '../data/modules'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

export function Feedback() {
  const [typeId, setTypeId] = useState<IssueTypeId>('bug')
  const [moduleId, setModuleId] = useState<ModuleId | 'unknown'>('core')
  const [copied, setCopied] = useState(false)
  const [copiedFields, setCopiedFields] = useState(false)
  const [summary, setSummary] = useState('')
  const [contact, setContact] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [issueUrl, setIssueUrl] = useState('')
  const sectionRef = useRef<HTMLElement | null>(null)
  const {
    health: relayHealth,
    latency: relayLatency,
    submitting: submitBusy,
    check: checkRelay,
    submit: submitRelay,
  } = useRelay(FEEDBACK_RELAY_URL)

  const type = useMemo(() => issueTypes.find((t) => t.id === typeId)!, [typeId])
  const option = useMemo(() => moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[3], [moduleId])
  const url = useMemo(() => buildIssueUrl(type), [type])
  const fields = useMemo(() => formFieldList(type), [type])
  const searchUrl = `${ISSUES}?q=${encodeURIComponent(
    `is:issue ${option.id === 'unknown' ? '' : option.formOption.split('（')[0]}`.trim(),
  )}`

  // 配置了中继地址时，反馈区进入视口再探测；地址为空时该函数直接返回，不发任何请求
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      void checkRelay()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void checkRelay()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkRelay])

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

  const copyFields = async () => {
    const text = [`${type.name}（${type.template}）的字段`, ...fields.map((f, i) => `${i + 1}. ${f}`)].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFields(true)
      window.setTimeout(() => setCopiedFields(false), 2000)
    } catch {
      setCopiedFields(false)
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
        在下方选择问题类型与涉及的模块，打开表单后标签会自动带上，标题沿用模板默认值，其余内容在 GitHub 上补齐后提交。
      </p>

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
            <div className="mt-3 space-y-2">
              {moduleOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModuleId(item.id)}
                  aria-pressed={item.id === moduleId}
                  className={`block w-full rounded-md border px-3 py-2 text-left text-[0.85rem] transition-colors ${
                    item.id === moduleId
                      ? 'border-seal bg-paper-sunk text-seal'
                      : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {item.formOption}
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
                    <code>{`${type.titlePrefix} …`}</code>
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

              <div className="mt-3 border-t border-dashed border-line pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[0.82rem] text-ink-faint">
                    GitHub 表单会按这个顺序逐项询问（共 {fields.length} 项）
                  </p>
                  <button type="button" onClick={copyFields} className="link-quiet text-[0.82rem] text-ink-soft">
                    {copiedFields ? '已复制字段清单' : '复制字段清单'}
                  </button>
                </div>
                <ol className="mt-2 space-y-1 text-[0.82rem] leading-relaxed text-ink-soft">
                  {fields.map((field, index) => (
                    <li key={field} className="flex gap-2">
                      <span className="num w-5 shrink-0 text-right text-ink-faint">{index + 1}</span>
                      <span>{field}</span>
                    </li>
                  ))}
                </ol>
              </div>
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

            {FEEDBACK_RELAY_URL ? (
              <div className="mt-4 border-t border-dashed border-line pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="text-[0.92rem] font-semibold text-ink">经中继直接提交</h4>
                  <span className="text-[0.82rem] text-ink-soft">
                    {relayHealth === 'checking' ? '正在检测中继…' : null}
                    {relayHealth === 'ok' ? `中继可用（${relayLatency} ms）` : null}
                    {relayHealth === 'fail' ? '中继不可用，请用上方的 GitHub 表单提交。' : null}
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
                    disabled={submitBusy || summary.trim().length < 4 || relayHealth !== 'ok'}
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
                  {submitState !== 'ok' && relayHealth === 'fail' ? (
                    <span className="text-ink-faint">中继探测未通过，按钮已停用；请用上方的 GitHub 表单提交。</span>
                  ) : null}
                  {submitState === 'idle' && relayHealth === 'ok' && summary.trim().length < 4 ? (
                    <span className="text-ink-faint">填写问题概述后即可提交。</span>
                  ) : null}
                  {relayHealth === 'checking' ? (
                    <span className="text-ink-faint">正在探测中继…</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {FEEDBACK_RELAY_URL ? null : (
              <p className="mt-4 text-[0.8rem] text-ink-faint">
                提交需要 GitHub 账号。无法注册账号时，也可通过官方发布帖或玩家群反馈。
              </p>
            )}
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
                      href={buildIssueUrl(item)}
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
                {FALLBACK_FEEDBACK_URL ? (
                  <li>
                    <a
                      href={FALLBACK_FEEDBACK_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-quiet inline-block py-1 text-ink-soft"
                    >
                      {FALLBACK_FEEDBACK_LABEL}
                    </a>
                  </li>
                ) : null}
                {SITE_MIRROR_URL ? (
                  <li>
                    <a href={SITE_MIRROR_URL} className="link-quiet inline-block py-1 text-ink-soft">
                      本站国内镜像
                    </a>
                  </li>
                ) : null}
              </ul>
            </Sheet>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
