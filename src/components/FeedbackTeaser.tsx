import { useEffect, useState } from 'react'
import { feedbackStatuses, statusCounts, type FeedbackRecord } from '../data/feedback'
import { loadRecords } from '../lib/feedbackClient'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

/**
 * 文档首页上的反馈入口。
 *
 * 完整的提交表单、进度区与记录列表都在独立的 feedback.html 上——那里是玩家从
 * 游戏里出来时的落点，不该埋在玩法说明的末尾。这里只留一个入口和一句进度概况，
 * 顺手把「现在有多少条、修了几条」说清楚，玩家就知道要不要先去看已有记录。
 */
export function FeedbackTeaser() {
  const [records, setRecords] = useState<FeedbackRecord[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadRecords(controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) setRecords(result.records)
    })
    return () => controller.abort()
  }, [])

  const counts = records ? statusCounts(records) : null
  const feedbackUrl = `${import.meta.env.BASE_URL}feedback.html`

  return (
    <section id="feedback" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="chapter-mark">反馈</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-3 text-2xl sm:text-[1.7rem]">遇到问题，这样告诉我们</h2>

      <Reveal className="mt-5">
        <Sheet className="p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[0.95rem] leading-relaxed text-ink-soft">
                反馈区在单独的页面上：填标题、版本、内容，有截图就拖进来，不需要注册任何账号。
                提交后拿到一个编号，进度会显示在同一页的进度区。
              </p>
              <a
                href={feedbackUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-seal px-4 py-2.5 text-[0.9rem] text-seal transition-colors hover:bg-paper-sunk"
              >
                前往反馈区提交 →
              </a>
              <p className="mt-2 text-[0.8rem] text-ink-faint">
                安装与配置类提问请到讨论区；反馈区处理可复现的问题与具体建议。
              </p>
            </div>

            <div className="lg:border-l lg:border-dashed lg:border-line lg:pl-6">
              <h3 className="text-[0.95rem] font-semibold text-ink">当前进度</h3>
              {counts && records ? (
                <>
                  <p className="mt-2 text-[0.85rem] text-ink-soft">
                    共 <span className="num text-ink">{records.length}</span> 条，已修复{' '}
                    <span className="num text-ink">{counts.fixed}</span> 条。
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {feedbackStatuses.map((status) => (
                      <li key={status.id} className="flex items-center justify-between gap-3 text-[0.83rem]">
                        <span className="text-ink-soft">{status.label}</span>
                        <span className="num text-ink-faint">{counts[status.id]}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={feedbackUrl} className="link-quiet mt-3 inline-block text-[0.82rem] text-ink-soft">
                    查看全部记录
                  </a>
                </>
              ) : (
                <p className="mt-2 text-[0.85rem] text-ink-soft">
                  记录与进度都在反馈页上，点上面的按钮过去看。
                </p>
              )}
            </div>
          </div>
        </Sheet>
      </Reveal>
    </section>
  )
}