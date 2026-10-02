import { useEffect, useRef, useState } from 'react'
import {
  FALLBACK_FEEDBACK_LABEL,
  buildDraftText,
  FALLBACK_FEEDBACK_URL,
  FEEDBACK_API,
  LIMITS,
  buildReceiptText,
  contactHint,
  contentHint,
  submitTips,
  titleHint,
  versionOptions,
  type FeedbackRecord,
} from '../data/feedback'
import { NO_SERVICE_MESSAGE, localProblems, submitFeedback } from '../lib/feedbackClient'
import { formatBytes, prepareImages, type PreparedImage } from '../lib/image'
import { Note, Sheet } from '../components/paper'

/**
 * 提交表单：标题 / 版本 / 内容 / 截图（可选）/ 联系方式（可选）。
 *
 * 页面自己收数据，不跳转、不需要账号；截图在浏览器里先缩到长边 1600 再提交，
 * 所以手机截图也能直接拖进来。提交成功后显示带编号的回执。
 */
export function SubmitForm({ onSubmitted }: { onSubmitted: (record: FeedbackRecord) => void }) {
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState(versionOptions[0])
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [images, setImages] = useState<PreparedImage[]>([])
  const [imageErrors, setImageErrors] = useState<string[]>([])
  const [honeypot, setHoneypot] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [receipt, setReceipt] = useState<FeedbackRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const [draftCopied, setDraftCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  /** 图片处理是异步的，用序号丢弃过期的结果（连续换图时可能乱序返回） */
  const prepareToken = useRef(0)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!draftCopied) return
    const timer = window.setTimeout(() => setDraftCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [draftCopied])

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    const room = LIMITS.imagesMax - images.length
    if (room <= 0) {
      setImageErrors([`最多附 ${LIMITS.imagesMax} 张图`])
      return
    }
    const token = ++prepareToken.current
    const { images: prepared, errors } = await prepareImages(files.slice(0, room))
    if (token !== prepareToken.current) return
    setImages((current) => [...current, ...prepared].slice(0, LIMITS.imagesMax))
    setImageErrors(errors)
  }

  const totalBytes = images.reduce((sum, image) => sum + image.bytes, 0)
  const problems = localProblems({ title, content, images })
  const ready = problems.length === 0
  const canSubmit = ready && !busy

  const submit = async () => {
    setProblem('')
    if (!ready) {
      setProblem(problems.join('；'))
      return
    }
    setBusy(true)
    const result = await submitFeedback({ title, version, content, contact, images, honeypot })
    setBusy(false)
    if (!result.ok) {
      setProblem(result.error)
      return
    }
    setReceipt(result.record)
    onSubmitted(result.record)
    setTitle('')
    setContent('')
    setContact('')
    setImages([])
    setImageErrors([])
  }

  const copyReceipt = async () => {
    if (!receipt) return
    try {
      await navigator.clipboard.writeText(buildReceiptText(receipt))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  /** 未配置服务时的出路：把填好的内容复制出来，玩家自己发给维护者 */
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(buildDraftText({ title, version, content, images }))
      setDraftCopied(true)
    } catch {
      setDraftCopied(false)
    }
  }

  const field =
    'mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-[0.9rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-seal'

  return (
    <Sheet className="p-5 sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
        {/* ---------- 左：填写 ---------- */}
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
              maxLength={LIMITS.titleMax}
              placeholder={titleHint}
              className={field}
            />
          </label>

          <label className="mt-5 block">
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[0.95rem] font-semibold text-ink">二　版本</span>
              <span className="text-[0.8rem] text-ink-faint">游戏里看到的本体版本号</span>
            </span>
            <select value={version} onChange={(event) => setVersion(event.target.value)} className={`${field} cursor-pointer`}>
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
                {content.trim().length} / {LIMITS.contentMax}
              </span>
            </span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value.slice(0, LIMITS.contentMax))}
              rows={8}
              placeholder={contentHint}
              className={`${field} leading-relaxed`}
            />
          </label>

          {/* ---------- 截图 ---------- */}
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[0.95rem] font-semibold text-ink">四　截图（可选）</span>
              <span className="text-[0.8rem] text-ink-faint">
                最多 {LIMITS.imagesMax} 张，会自动压缩
                {images.length ? `　已选 ${images.length} 张 / ${formatBytes(totalBytes)}` : ''}
              </span>
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void addFiles([...event.dataTransfer.files])
              }}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition-colors ${
                dragging ? 'border-seal bg-paper-sunk' : 'border-line bg-paper-sunk/50 hover:border-line-strong'
              }`}
            >
              <span className="text-[0.86rem] text-ink-soft">把截图拖到这里，或点一下选择文件</span>
              <span className="mt-1 text-[0.78rem] text-ink-faint">
                png / jpg / webp / gif；界面错位、渲染异常这类问题尽量附一张
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void addFiles([...(event.target.files ?? [])])
                  event.target.value = ''
                }}
              />
            </label>

            {imageErrors.length ? (
              <ul className="mt-2 space-y-1">
                {imageErrors.map((error) => (
                  <li key={error} className="text-[0.8rem] text-seal">
                    {error}
                  </li>
                ))}
              </ul>
            ) : null}

            {images.length ? (
              <ul className="mt-3 flex flex-wrap gap-3">
                {images.map((image, index) => (
                  <li key={`${image.name}-${index}`} className="w-32">
                    <div className="relative overflow-hidden rounded-md border border-line">
                      <img src={image.dataUrl} alt={image.name} className="h-20 w-32 object-cover" />
                      <button
                        type="button"
                        aria-label={`移除 ${image.name}`}
                        onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm border border-line bg-paper/90 text-[0.72rem] text-ink-soft hover:text-seal"
                      >
                        ×
                      </button>
                    </div>
                    <p className="num mt-1 text-[0.7rem] text-ink-faint">
                      {image.compressed ? `${formatBytes(image.originalBytes)} → ${formatBytes(image.bytes)}` : formatBytes(image.bytes)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* ---------- 右：提交 ---------- */}
        <div className="lg:border-l lg:border-dashed lg:border-line lg:pl-7">
          <h3 className="text-[1rem] font-semibold text-ink">提交</h3>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-soft">
            提交后立即出现在下面的记录里，并得到一个编号；不需要注册，也不需要跳转到别的网站。
          </p>

          <label className="mt-4 block">
            <span className="text-[0.82rem] text-ink-faint">{contactHint}</span>
            <input
              type="text"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              maxLength={LIMITS.contactMax}
              autoComplete="email"
              className={field}
            />
          </label>

          <input
            type="text"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="sr-only"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`mt-4 w-full rounded-md border px-4 py-2.5 text-[0.9rem] transition-colors ${
              canSubmit ? 'border-seal text-seal hover:bg-paper-sunk' : 'cursor-not-allowed border-line text-ink-faint'
            }`}
          >
            {busy ? '正在提交…' : '提交反馈'}
          </button>

          <p className="mt-2 text-[0.8rem] text-ink-faint">
            {ready ? '提交即写入反馈服务，无需账号。' : `还差：${problems.join('；')}`}
          </p>

          {!FEEDBACK_API ? (
            <div className="mt-3">
              <Note title="注意：">{NO_SERVICE_MESSAGE}</Note>
              <button
                type="button"
                onClick={copyDraft}
                disabled={!title.trim() && !content.trim()}
                className="mt-2 rounded-md border border-line px-3 py-1.5 text-[0.83rem] text-ink-soft transition-colors enabled:hover:border-line-strong enabled:hover:text-ink disabled:cursor-not-allowed disabled:text-ink-faint"
              >
                {draftCopied ? '已复制，去发给维护者' : '复制填好的内容'}
              </button>
              {FALLBACK_FEEDBACK_URL ? (
                <a
                  href={FALLBACK_FEEDBACK_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-[0.85rem] text-ink-soft link-quiet"
                >
                  {FALLBACK_FEEDBACK_LABEL} →
                </a>
              ) : null}
            </div>
          ) : null}

          {problem ? (
            <p role="alert" className="mt-3 rounded-md border border-seal/40 bg-paper-sunk/60 px-3 py-2 text-[0.83rem] text-seal">
              {problem}
            </p>
          ) : null}

          {receipt ? (
            <div className="mt-3 rounded-md border border-jade/40 bg-paper-sunk/60 px-3 py-2.5">
              <p className="text-[0.88rem] text-ink">
                已提交，编号 <span className="num font-semibold text-jade">{receipt.id}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href="#records" className="link-quiet text-[0.83rem] text-ink-soft">
                  在下面的记录里查看
                </a>
                <button type="button" onClick={copyReceipt} className="link-quiet text-[0.83rem] text-ink-soft">
                  {copied ? '已复制回执' : '复制回执'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-2 border-t border-dashed border-line pt-4">
            {submitTips.map((tip) => (
              <Note key={tip}>{tip}</Note>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}