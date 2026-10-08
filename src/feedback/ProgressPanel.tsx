import {
  feedbackStatuses,
  statusCounts,
  type FeedbackRecord,
  type FeedbackStatusId,
} from '../data/feedback'
import { Sheet } from '../components/paper'

/** 状态徽标与进度条的配色 */
export const toneClass: Record<string, string> = {
  seal: 'tag tag-seal',
  indigo: 'tag border-indigo/50 text-indigo',
  jade: 'tag border-jade/50 text-jade',
  faint: 'tag text-ink-faint',
}

const barClass: Record<string, string> = {
  seal: 'bg-seal',
  indigo: 'bg-indigo',
  jade: 'bg-jade',
  faint: 'bg-line-strong',
}

export function StatusBadge({ status }: { status: FeedbackStatusId }) {
  const meta = feedbackStatuses.find((item) => item.id === status) ?? feedbackStatuses[0]
  return <span className={toneClass[meta.tone]}>{meta.label}</span>
}

/** 进度区：各状态条数、占比与分段进度条 */
export function ProgressPanel({ records }: { records: FeedbackRecord[] }) {
  const counts = statusCounts(records)
  const total = records.length
  const fixed = counts.fixed

  return (
    <Sheet className="p-5 sm:p-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[0.85rem] text-ink-soft">
            已修复 <span className="num text-ink">{fixed}</span> / 共 <span className="num text-ink">{total}</span> 条反馈
          </p>
          <p className="num text-[0.85rem] text-ink-faint">{total ? Math.round((fixed / total) * 100) : 0}%</p>
        </div>
        <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full border border-line bg-paper-sunk">
          {feedbackStatuses.map((status) => {
            const width = total ? (counts[status.id] / total) * 100 : 0
            if (!width) return null
            return (
              <span
                key={status.id}
                className={barClass[status.tone]}
                style={{ width: `${width}%` }}
                title={`${status.label} ${counts[status.id]} 条`}
              />
            )
          })}
        </div>
      </div>

      {total > 0 && fixed === 0 ? (
        <p className="mt-2 text-[0.82rem] text-ink-faint">
          目前的 {total} 条都还没有标记为已修复：其中大多是早期导入的反馈。
        </p>
      ) : null}

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {feedbackStatuses.map((status) => (
          <li key={status.id} className="rounded-md border border-dashed border-line px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className={toneClass[status.tone]}>{status.label}</span>
              <span className="num text-[1.05rem] text-ink">{counts[status.id]}</span>
            </div>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-faint">{status.desc}</p>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}