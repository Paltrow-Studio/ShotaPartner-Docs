import { Fragment, useEffect, useState } from 'react'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Contents } from './components/Contents'
import { ChapterSection } from './components/Guide'
import { Roster } from './components/Roster'
import { Reference } from './components/Reference'
import { Install } from './components/Install'
import { Faq } from './components/Faq'
import { Feedback } from './components/Feedback'
import { Footer } from './components/Footer'
import { chapters } from './data/guide'
import { faqItems } from './data/faq'

/** FAQ 结构化数据，便于搜索引擎收录 */
function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 1200)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`no-print fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-sheet text-[0.9rem] text-ink-soft shadow-lg transition-all duration-300 hover:text-seal ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      aria-label="回到顶部"
    >
      ↑
    </button>
  )
}

const extraSections = [
  { id: 'reference', title: '按键与物品' },
  { id: 'install', title: '装之前要确认的事' },
  { id: 'faq', title: '常被问到的几件事' },
  { id: 'feedback', title: '遇到问题，这样告诉我们' },
  { id: 'progress', title: '反馈处理进度' },
  { id: 'board', title: '全部反馈' },
]

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="grain-layer" aria-hidden="true" />

      <a
        href="#gameplay"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:border focus:border-line-strong focus:bg-sheet focus:px-4 focus:py-2 focus:text-[0.9rem] focus:text-ink"
      >
        跳到正文
      </a>

      <Nav />
      <main className="relative z-10">
        <Hero />
        <Contents chapters={chapters} extra={extraSections} />

        <div id="gameplay" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-6xl space-y-12 px-5 pt-8 sm:px-6">
            {chapters.map((chapter, index) => (
              <Fragment key={chapter.id}>
                <ChapterSection chapter={chapter} />
                {index === 0 ? <Roster /> : null}
              </Fragment>
            ))}
          </div>
        </div>

        <Reference />
        <Install />
        <Faq />
        <Feedback />
      </main>
      <Footer />
      <BackToTop />
      <FaqJsonLd />
    </div>
  )
}
