import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildDraftText,
  buildIssueUrl,
  contentHint,
  feedbackForm,
  mediaNote,
  submitTips,
  versionOptions,
} from '../data/feedback'
import { DISCUSSIONS, FEEDBACK_RELAY_URL, GITHUB_REPO } from '../data/site'
import { useRelay } from '../lib/relay'
import { Note, Sheet } from './paper'
import { Reveal } from './Reveal'
import { IssueBoard } from './IssueBoard'

/** 「内容」的字数上限，与服务端校验保持一致 */
const CONTENT_MAX = 4000

/**
 * 反馈区：原来的四套表单合并成一张四项表单（标题 / 版本 / 内容 / 截图）。
 * 页面只生成 GitHub 表单深链，标题、版本、内容三项预填，截图在 GitHub 的上传框里拖入。
 * 配置了中继地址时，另外给一个无需 GitHub 账号的直接提交按钮。
 */
export function Feedback() {
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState(versionOptions[0])
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [issueUrl, setIssueUrl] = useState('')
  const sectionRef = useRef<HTMLElement | null>(null)
  const {
    health: relayHealth,
    submitting: submitBusy,
    check: checkRelay,
    submit: submitRelay,
  } = useRelay(FEEDBACK_RELAY_URL)

  const draft = useMemo(() => ({ title, version, content }), [title, version, content])
  const ready = title.trim().length >= 4 && content.trim().length >= 20
  const url = useMemo(() => buildIssueUrl(draft), [draft])

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
    const result = await submitRelay({
      title: title.trim(),
      version,
      content: content.trim(),
      contact: contact.trim(),
      titlePrefix: feedbackForm.titlePrefix,
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
      await navigator.clipboard.writeText(buildDraftText(draft))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const field =
    'mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-[0.9rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-seal'

  return (
    <>
      <section
        id="feedback"
        ref={sectionRef}
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <span className="chapter-mark">反馈</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <h2 className="mt-3 text-2xl sm:text-[1.7rem]">遇到问题，这样告诉我们</h2>
        <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
          只填四项：标题、版本、内容，有截图就附上。不用选类型、不用填环境表，也不需要先读一长串规则；
          提交后由维护者判断分类并补标签，处理进度会更新在下面的进度区。
        </p>

        <Reveal className="mt-5">
          <Sheet className="p-5 sm:p-7">
            <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
              {/* ---------- 左：四项 ---------- */}
              <div>
                <label className="block">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.95rem] font-semibold text-ink">一　标题</span>
                    <span className="text-[0.8rem] text-ink-faint">一句话说清现象即可</span>
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    placeholder="伙伴不拾取掉落物"
                    className={field}
                  />
                </label>

                <label className="mt-5 block">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.95rem] font-semibold text-ink">二　版本</span>
                    <span className="text-[0.8rem] text-ink-faint">游戏里看到的本体版本号</span>
                  </span>
                  <select
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    className={`${field} cursor-pointer`}
                  >
                    {versionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-5 block">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.95rem] font-semibold text-ink">三　内容</span>
                    <span className="num text-[0.75rem] text-ink-faint">
                      {content.length} / {CONTENT_MAX}
                    </span>
                  </span>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value.slice(0, CONTENT_MAX))}
                    rows={8}
                    placeholder={contentHint}
                    className={`${field} leading-relaxed`}
                  />
                </label>

                <div className="mt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.95rem] font-semibold text-ink">四　截图（可选）</span>
                    <span className="text-[0.8rem] text-ink-faint">界面错位、渲染异常这类问题尽量附一张</span>
                  </div>
                  <p className="mt-2 rounded-md border border-dashed border-line bg-paper-sunk/50 px-3 py-2 text-[0.83rem] leading-relaxed text-ink-soft">
                    {mediaNote}
                  </p>
                </div>
              </div>

              {/* ---------- 右：提交 ---------- */}
              <div className="lg:border-l lg:border-dashed lg:border-line lg:pl-7">
                <h3 className="text-[1rem] font-semibold text-ink">提交</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-soft">
                  点下面的按钮打开表单，标题、版本、内容已经替你填好，确认后点「Create」；截图在表单里拖进上传框。
                </p>

                <a
                  href={ready ? url : undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-disabled={!ready}
                  onClick={(event) => {
                    if (!ready) event.preventDefault()
                  }}
                  className={`mt-4 inline-flex w-full items-center justify-center rounded-md border px-4 py-2.5 text-[0.9rem] transition-colors ${
                    ready
                      ? 'border-seal text-seal hover:bg-paper-sunk'
                      : 'cursor-not-allowed border-line text-ink-faint'
                  }`}
                >
                  打开 GitHub 表单提交 →
                </a>
                <p className="mt-2 text-[0.8rem] text-ink-faint">
                  {ready
                    ? '标题、版本、内容会一并带入表单。'
                    : '填好标题（4 字以上）与内容（20 字以上）即可提交。'}
                </p>

                <button type="button" onClick={copy} className="link-quiet mt-3 block text-[0.85rem] text-ink-soft">
                  {copied ? '已复制' : '复制内容（打不开 GitHub 时转发给维护者）'}
                </button>

                {FEEDBACK_RELAY_URL ? (
                  <div className="mt-5 border-t border-dashed border-line pt-4">
                    <p className="text-[0.88rem] font-semibold text-ink">没有 GitHub 账号</p>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-soft">
                      用下面的按钮直接提交，由站点中继代为创建 issue，浏览器不需要能打开 github.com。
                    </p>
                    <input
                      type="text"
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      maxLength={120}
                      placeholder="联系方式（可选，便于回访）"
                      className={field}
                    />
                    <input
                      type="text"
                      value={honeypot}
                      onChange={(event) => setHoneypot(event.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="pointer-events-none absolute h-0 w-0 opacity-0"
                    />
                    <button
                      type="button"
                      onClick={submitByRelay}
                      disabled={!ready || submitBusy || relayHealth === 'fail'}
                      className={`mt-3 w-full rounded-md border px-4 py-2.5 text-[0.9rem] transition-colors ${
                        ready && !submitBusy && relayHealth !== 'fail'
                          ? 'border-line-strong text-ink hover:bg-paper-sunk'
                          : 'cursor-not-allowed border-line text-ink-faint'
                      }`}
                    >
                      {submitBusy ? '正在提交…' : '直接提交（无需 GitHub 账号）'}
                    </button>
                    {relayHealth === 'fail' ? (
                      <p className="mt-2 text-[0.8rem] text-ink-faint">
                        中继探测未通过，按钮已停用；请用上面的 GitHub 表单提交。
                      </p>
                    ) : null}
                    {submitState === 'ok' ? (
                      <p className="mt-2 text-[0.82rem] text-jade">
                        已提交：
                        <a href={issueUrl} target="_blank" rel="noreferrer noopener" className="link-quiet">
                          {issueUrl}
                        </a>
                      </p>
                    ) : null}
                    {submitState === 'error' ? (
                      <p className="mt-2 text-[0.82rem] text-seal">提交失败：{submitMessage}</p>
                    ) : null}
                  </div>
                ) : null}

                <dl className="mt-5 space-y-1.5 border-t border-dashed border-line pt-4 text-[0.82rem]">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-ink-faint">表单</dt>
                    <dd>
                      <code className="rounded-sm border border-line bg-paper-sunk px-1 text-[0.8rem]">
                        {feedbackForm.template}
                      </code>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-ink-faint">标题</dt>
                    <dd className="text-ink-soft">
                      <code className="rounded-sm border border-line bg-paper-sunk px-1 text-[0.8rem]">
                        {`${feedbackForm.titlePrefix} ${title.trim() || '…'}`}
                      </code>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-ink-faint">标签</dt>
                    <dd className="flex flex-wrap items-center gap-1.5">
                      {feedbackForm.labels.split(',').map((label) => (
                        <span key={label} className="tag">
                          {label}
                        </span>
                      ))}
                      <span className="text-ink-faint">分类由维护者补</span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </Sheet>
        </Reveal>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {submitTips.map((tip) => (
            <Note key={tip}>{tip}</Note>
          ))}
        </div>

        <p className="mt-4 text-[0.82rem] text-ink-faint">
          安装、配置这类提问请发到
          <a href={DISCUSSIONS} target="_blank" rel="noreferrer noopener" className="link-quiet">
            讨论区
          </a>
          ，反馈区只处理可复现的问题与具体建议；也可以先到
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer noopener" className="link-quiet">
            仓库
          </a>
          看看已有记录。提交需要 GitHub 账号，没有账号时用「复制内容」把三项发给维护者。
        </p>
      </section>

      <IssueBoard />
    </>
  )
}