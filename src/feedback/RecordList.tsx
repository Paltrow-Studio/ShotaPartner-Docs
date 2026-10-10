import { useMemo, useState } from 'react'
import {
  FALLBACK_FEEDBACK_URL,
  feedbackStatuses,
  resolveImageUrl,
  statusCounts,
  type FeedbackRecord,
  type FeedbackStatusId,
} from '../data/feedback'
import { Sheet } from '../components/paper'
import { StatusBadge } from './ProgressPanel'

/**
 * 记录列表：按统一格式展示全部反馈（标题 / 版本 / 内容 / 截图 / 状态 / 时间）。
 * 早期从 issue 导入的记录带 legacyUrl，点标题可以回到原始讨论。
 */
function RecordItem({ record }: { record: FeedbackRecord }) {
  const [failed, setFailed] = useState<string[]>([])

  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="num text-[0.78rem] text-ink-faint">{record.id}</span>
          <h3 className="text-[0.95rem] font-semibold text-ink">{record.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {record.version ? <span className="tag">v{record.version}</span> : null}
          <StatusBadge status={record.status} />
        </div>
      </div>

      <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-soft">{record.content}</p>

      {record.images.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {record.images.map((src) => {
            const url = resolveImageUrl(src)
            if (failed.includes(src)) {
              // 早期记录的截图存在 GitHub 上，国内多半加载不出来。
              // 与其让图悄悄消失（内容里明明说了「见图」），不如摆明原因。
              return (
                <span
                  key={src}
                  className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed border-line px-2 text-center text-[0.7rem] leading-tight text-ink-faint"
                >
                  截图加载不出来
                </span>
              )
            }
            return (
              <a
                key={src}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="block overflow-hidden rounded-md border border-line"
              >
                <img
                  src={url}
                  alt="反馈截图"
                  loading="lazy"
                  className="h-20 w-32 object-cover"
                  onError={() => setFailed((current) => [...current, src])}
                />
              </a>
            )
          })}
        </div>
      ) : null}

      {failed.length ? (
        <p className="mt-2 text-[0.78rem] text-ink-faint">
          {/* 不把原因说死：网络不通与「原图在 GitHub 上已经失效」都会走到这里，
              而这 23 条里确实各有一例。 */}
          有截图没能加载出来
          {record.legacyUrl ? '。早期记录的截图存放在 GitHub 上，网络不通或原图已失效都会这样' : ''}。
        </p>
      ) : null}

      <p className="num mt-3 flex flex-wrap items-center gap-x-3 text-[0.78rem] text-ink-faint">
        <span>{record.createdAt.slice(0, 10)}</span>
        {record.issueUrl ? (
          <a href={record.issueUrl} target="_blank" rel="noreferrer noopener" className="link-quiet">
            在 issue 区查看
          </a>
        ) : null}
        {record.legacyUrl ? (
          <a href={record.legacyUrl} target="_blank" rel="noreferrer noopener" className="link-quiet">
            早期记录的原讨论
          </a>
        ) : null}
      </p>
    </li>
  )
}

export function RecordList({
  records,
  loading,
  error,
  notice,
  live,
  generatedAt,
}: {
  records: FeedbackRecord[]
  loading: boolean
  error?: string
  notice?: string
  live: boolean
  generatedAt: string
}) {
  const [filter, setFilter] = useState<FeedbackStatusId | 'all'>('all')
  const counts = useMemo(() => statusCounts(records), [records])
  const list = filter === 'all' ? records : records.filter((record) => record.status === filter)

  const filters: { id: FeedbackStatusId | 'all'; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: records.length },
    ...feedbackStatuses.map((status) => ({ id: status.id, label: status.label, count: counts[status.id] })),
  ]

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="chapter-mark">记录</span>
            <span className="h-px w-24 bg-line sm:w-40" />
          </div>
          <h2 className="mt-3 text-2xl sm:text-[1.7rem]">全部反馈</h2>
        </div>
        {!loading && records.length ? (
          <div className="flex flex-wrap gap-2 text-[0.82rem]">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`rounded-md border px-2.5 py-1 transition-colors ${
                  filter === item.id
                    ? 'border-seal text-seal'
                    : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
                }`}
              >
                {item.label}
                <span className="num ml-1.5 text-ink-faint">{item.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-4 rounded-md border border-dashed border-line bg-paper-sunk/50 px-3 py-2 text-[0.83rem] text-ink-soft">
          {notice}
        </p>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <Sheet className="p-5">
            <p className="text-[0.9rem] text-ink-faint">正在载入记录…</p>
          </Sheet>
        ) : error ? (
          <Sheet className="p-5">
            <p className="text-[0.9rem] text-ink-soft">{error}</p>
            {FALLBACK_FEEDBACK_URL ? (
              <a
                href={FALLBACK_FEEDBACK_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="link-quiet mt-2 inline-block text-[0.85rem] text-ink-soft"
              >
                改用备用表单提交 →
              </a>
            ) : null}
          </Sheet>
        ) : list.length ? (
          <Sheet className="divide-y divide-dashed divide-line">
            <ul>
              {list.map((record) => (
                <RecordItem key={record.id} record={record} />
              ))}
            </ul>
          </Sheet>
        ) : (
          <Sheet className="p-5">
            <p className="text-[0.9rem] text-ink-soft">
              {records.length ? '这个状态下暂时没有条目。' : '还没有反馈记录。第一条就交给你了。'}
            </p>
          </Sheet>
        )}
      </div>

      {!loading && !error ? (
        <p className="num mt-3 text-[0.78rem] text-ink-faint">
          {live ? '数据来自反馈服务（实时）' : generatedAt ? `静态副本更新于 ${generatedAt.slice(0, 10)}` : '静态副本'}
          {records.length ? `　共 ${records.length} 条` : ''}
        </p>
      ) : null}
    </>
  )
}