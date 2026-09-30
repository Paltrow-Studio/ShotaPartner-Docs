import { useEffect, useState } from 'react'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Architecture } from './components/Architecture'
import { Modules } from './components/Modules'
import { Features } from './components/Features'
import { Install } from './components/Install'
import { Faq } from './components/Faq'
import { Feedback } from './components/Feedback'
import { Footer } from './components/Footer'
import { Icon } from './components/Icons'
import { faqItems } from './data/faq'

/** FAQ 结构化数据，便于搜索引擎收录（页面本身也是静态的，直接内联一段 JSON-LD） */
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
    const onScroll = () => setShow(window.scrollY > 900)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-ink-850/90 text-slate-200 shadow-xl backdrop-blur transition-all duration-300 hover:border-white/30 hover:text-white ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      aria-label="回到顶部"
    >
      <Icon name="arrowRight" className="h-4.5 w-4.5 -rotate-90" />
    </button>
  )
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a
        href="#modules"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-ink-950"
      >
        跳到主要内容
      </a>

      <Nav />
      <main>
        <Hero />
        <Architecture />
        <Modules />
        <Features />
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
