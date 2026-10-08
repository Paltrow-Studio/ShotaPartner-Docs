import { useEffect, useState } from 'react'
import { DOCS_URL, LIMITS, type FeedbackRecord } from '../data/feedback'
import { loadRecords } from '../lib/feedbackClient'
import { DISCUSSIONS } from '../data/site'
import { useTheme } from '../lib/theme'
import { Note } from '../components/paper'
import { ProgressPanel } from './ProgressPanel'
import { RecordList } from './RecordList'
import { SubmitForm } from './SubmitForm'

/**
 * 反馈区独立页面（feedback.html）。
 *
 * 独立成页的原因：反馈区不该埋在玩法说明的末尾，玩家从游戏里出来时应该
 * 一眼看到「怎么提交、进度在哪」。这一页不依赖 GitHub：不需要账号、不跳转。
 */

const SECTIONS = [
  { id: 'submit', label: '提交' },
  { id: 'progress', label: '进度' },
  { id: 'records', label: '记录' },
]

function Header({ active }: { active: string }) {
  const { theme, setTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? 'border-line bg-paper/92 backdrop-blur-sm' : 'border-transparent bg-paper/70'
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <a href={DOCS_URL} className="flex items-baseline gap-2.5">
          <span className="font-serif text-[1.05rem] font-semibold tracking-wide text-ink">伙伴物语</span>
          <span className="text-[0.85rem] text-seal">反馈区</span>
        </a>

        <ul className="hidden items-center gap-5 sm:flex">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`text-[0.88rem] transition-colors ${
                  active === section.id ? 'text-seal' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {section.label}
              </a>
            </li>
          ))}
          <li>
            <a href={DOCS_URL} className="text-[0.88rem] text-ink-soft transition-colors hover:text-ink">
              返回文档
            </a>
          </li>
        </ul>

        <div className="flex items-center rounded-md border border-line p-[2px]" role="group" aria-label="主题">
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={`rounded-[3px] px-2 py-[0.15rem] text-[0.74rem] transition-colors ${
                theme === value ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {value === 'light' ? '日' : '夜'}
            </button>
          ))}
        </div>
      </nav>

      <div className="border-t border-dashed border-line sm:hidden">
        <ul className="mx-auto flex w-full max-w-6xl gap-4 px-5 py-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-[0.82rem] text-ink-soft">
                {section.label}
              </a>
            </li>
          ))}
          <li className="ml-auto">
            <a href={DOCS_URL} className="text-[0.82rem] text-ink-soft">
              返回文档
            </a>
          </li>
        </ul>
      </div>
    </header>
  )
}

export function FeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [state, setState] = useState<{ loading: boolean; live: boolean; generatedAt: string; notice?: string; error?: string }>({
    loading: true,
    live: false,
    generatedAt: '',
  })
  const [active, setActive] = useState('submit')

  useEffect(() => {
    const controller = new AbortController()
    void loadRecords(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setRecords(result.records)
      setState({
        loading: false,
        live: result.live,
        generatedAt: result.generatedAt,
        notice: result.notice,
        error: result.ok ? undefined : result.error,
      })
    })
    return () => controller.abort()
  }, [])

  // 高亮当前区块：只用 IntersectionObserver，不引入额外依赖
  useEffect(() => {
    const elements = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    )
    if (!elements.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.15, 0.5, 1] },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  /** 新提交立刻出现在列表与进度里，不必等刷新 */
  const addRecord = (record: FeedbackRecord) => {
    setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header active={active} />

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-24 sm:px-6 sm:pt-28">
        <div className="flex items-center gap-3">
          <span className="chapter-mark">反馈</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <h1 className="mt-3 text-[1.7rem] leading-snug sm:text-[2rem]">遇到问题，这样告诉我们</h1>
        <p className="mt-3 max-w-3xl text-[0.98rem] leading-relaxed text-ink-soft">
          只填三项：标题、版本、内容，有截图就拖进来。不用注册账号，不用跳转到别的网站，
          也不用先读一长串规则。提交后立刻拿到一个编号，进度会显示在下面。
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { title: '不需要账号', text: '在这里填完就是提交，没有注册、登录、跳转。' },
            { title: '可以带截图', text: `最多 ${LIMITS.imagesMax} 张，页面会先压缩再上传，手机截图直接拖进来。` },
            { title: '编号可追踪', text: '每条反馈都有编号，进度区按待处理 / 排查中 / 已修复 / 已关闭更新。' },
          ].map((item) => (
            <li key={item.title} className="rounded-md border border-dashed border-line px-3 py-2.5">
              <p className="text-[0.88rem] font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-faint">{item.text}</p>
            </li>
          ))}
        </ul>

        <section id="submit" className="mt-10 scroll-mt-24">
          <div className="flex items-center gap-3">
            <span className="chapter-mark">提交</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <h2 className="mb-5 mt-3 text-2xl sm:text-[1.7rem]">提交反馈</h2>
          <SubmitForm onSubmitted={addRecord} />
        </section>

        <section id="progress" className="mt-14 scroll-mt-24">
          <div className="flex items-center gap-3">
            <span className="chapter-mark">进度</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <h2 className="mt-3 text-2xl sm:text-[1.7rem]">处理进度</h2>
          <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
            {state.live
              ? '数据来自反馈服务，改状态后这里立刻更新。'
              : '反馈服务上线前，这里显示的是最近一次同步的静态副本。'}
          </p>
          <div className="mt-5">
            <ProgressPanel records={records} />
          </div>
        </section>

        <section id="records" className="mt-14 scroll-mt-24">
          <RecordList
            records={records}
            loading={state.loading}
            error={state.error}
            notice={state.notice}
            live={state.live}
            generatedAt={state.generatedAt}
          />
        </section>

        <section className="mt-14">
          <div className="grid gap-3 lg:grid-cols-2">
            <Note title="受理范围：">
              可复现的问题、界面与数值错误、崩溃，以及具体的改进建议。安装与配置类提问、玩法讨论请到{' '}
              <a href={DISCUSSIONS} target="_blank" rel="noreferrer noopener" className="link-quiet text-seal">
                讨论区
              </a>
              ，那里更容易被其他玩家看到。
            </Note>
            <Note title="隐私：">
              填写的联系方式只会写进反馈服务的存储、供维护者回访，不会出现在这一页的公开记录里；截图会公开显示，注意别把自己的账号或服务器地址拍进去。
            </Note>
          </div>
        </section>

        <footer className="mt-14 border-t border-dashed border-line pt-5 text-[0.82rem] text-ink-faint">
          <p>
            {state.live
              ? '记录与进度保存在本站自己的反馈服务里，改状态后这一页立刻更新。'
              : '记录与进度不依赖任何第三方平台。反馈服务尚未上线，这一页显示的是最近一次同步的记录。'}
          </p>
          <p className="mt-2">
            <a href={DOCS_URL} className="link-quiet">
              返回玩法说明
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}