import { useEffect, useMemo, useState } from 'react'
import {
  ISSUE_SNAPSHOT_URL,
  issueStatuses,
  statusCounts,
  type BoardIssue,
  type IssueSnapshot,
  type IssueStatusId,
} from '../data/feedback'
import { GITHUB_REPO } from '../data/site'
import { Sheet } from './paper'
import { Reveal } from './Reveal'

/** 状态徽标的配色，与进度条一致 */
const toneClass: Record<string, string> = {
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

function StatusBadge({ status }: { status: IssueStatusId }) {
  const meta = issueStatuses.find((s) => s.id === status) ?? issueStatuses[0]
  return <span className={toneClass[meta.tone]}>{meta.label}</span>
}

/** 进度条：按状态分段，宽度按条数占比 */
function ProgressBar({ counts, total }: { counts: Record<IssueStatusId, number>; total: number }) {
  const done = counts.fixed
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.85rem] text-ink-soft">
          已修复 <span className="num text-ink">{done}</span> / 共{' '}
          <span className="num text-ink">{total}</span> 条反馈
        </p>
        <p className="num text-[0.85rem] text-ink-faint">
          {total ? Math.round((done / total) * 100) : 0}%
        </p>
      </div>
      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full border border-line bg-paper-sunk">
        {issueStatuses.map((status) => {
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
  )
}

/** 一条反馈：标题 / 版本 / 内容 / 截图 —— 与提交流程同样的四项 */
function IssueCard({ issue }: { issue: BoardIssue }) {
  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer noopener"
          className="link-quiet text-[0.95rem] font-semibold text-ink"
        >
          {issue.title}
        </a>
        <div className="flex flex-wrap items-center gap-2">
          {issue.version ? <span className="tag">v{issue.version}</span> : null}
          <StatusBadge status={issue.status} />
        </div>
      </div>

      {issue.content ? (
        <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-soft">{issue.content}</p>
      ) : null}

      {issue.images.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {issue.images.slice(0, 4).map((src) => (
            <a
              key={src}
              href={issue.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block overflow-hidden rounded-md border border-line"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="h-20 w-32 object-cover"
                onError={(event) => {
                  // 图挂了不影响阅读：直接收起这一格
                  const box = event.currentTarget.closest('a')
                  if (box) box.style.display = 'none'
                }}
              />
            </a>
          ))}
          {issue.images.length > 4 ? (
            <span className="self-center text-[0.8rem] text-ink-faint">
              另有 {issue.images.length - 4} 张图在 issue 里
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="num mt-3 text-[0.78rem] text-ink-faint">
        #{issue.number}　{issue.createdAt.slice(0, 10)}
      </p>
    </li>
  )
}

/**
 * 进度区 + 展示区：状态统计、进度条，以及按统一格式展示的全部反馈。
 * 数据来自构建时生成的同源快照 issues.json，页面不请求任何外部接口。
 */
export function IssueBoard() {
  const [snapshot, setSnapshot] = useState<IssueSnapshot | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading')
  const [filter, setFilter] = useState<IssueStatusId | 'all'>('all')

  useEffect(() => {
    let alive = true
    fetch(ISSUE_SNAPSHOT_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('取不到快照'))))
      .then((data: IssueSnapshot) => {
        if (!alive) return
        setSnapshot(data)
        setState(data.issues?.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (alive) setState('empty')
      })
    return () => {
      alive = false
    }
  }, [])

  const issues = snapshot?.issues ?? []
  const counts = useMemo(() => statusCounts(issues), [issues])
  const list = filter === 'all' ? issues : issues.filter((issue) => issue.status === filter)

  const filters: { id: IssueStatusId | 'all'; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: issues.length },
    ...issueStatuses.map((status) => ({ id: status.id, label: status.label, count: counts[status.id] })),
  ]

  return (
    <>
      <section id="progress" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="chapter-mark">进度</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <h2 className="mt-3 text-2xl sm:text-[1.7rem]">反馈处理进度</h2>
        <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">
          这里列出所有反馈及其当前状态。状态由维护者在 issue 上更新，进度区随站点一起重新生成，
          因此看到「已修复」时，说明修复已经进入某个版本的包里。
        </p>

        <Reveal className="mt-6">
          <Sheet className="p-5 sm:p-6">
            {state === 'loading' ? (
              <p className="text-[0.9rem] text-ink-faint">正在载入反馈列表…</p>
            ) : state === 'empty' ? (
              <p className="text-[0.9rem] text-ink-soft">
                暂时取不到反馈列表。可以直接到{' '}
                <a href={`${GITHUB_REPO}/issues`} target="_blank" rel="noreferrer noopener" className="link-quiet">
                  GitHub issue 区
                </a>{' '}
                查看。
              </p>
            ) : (
              <>
                <ProgressBar counts={counts} total={issues.length} />

                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {issueStatuses.map((status) => (
                    <li
                      key={status.id}
                      className="rounded-md border border-dashed border-line px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={toneClass[status.tone]}>{status.label}</span>
                        <span className="num text-[1.05rem] text-ink">{counts[status.id]}</span>
                      </div>
                      <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-faint">{status.desc}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Sheet>
        </Reveal>
      </section>

      <section id="board" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="chapter-mark">记录</span>
              <span className="h-px w-24 bg-line sm:w-40" />
            </div>
            <h2 className="mt-3 text-2xl sm:text-[1.7rem]">全部反馈</h2>
          </div>
          {state === 'ready' ? (
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

        <Reveal className="mt-6">
          {state === 'ready' && list.length ? (
            <Sheet className="divide-y divide-dashed divide-line">
              <ul>
                {list.map((issue) => (
                  <IssueCard key={issue.number} issue={issue} />
                ))}
              </ul>
            </Sheet>
          ) : (
            <Sheet className="p-5">
              <p className="text-[0.9rem] text-ink-soft">
                {state === 'loading'
                  ? '正在载入反馈列表…'
                  : state === 'empty'
                    ? '暂时取不到反馈列表，可到 GitHub issue 区查看。'
                    : '这个状态下暂时没有条目。'}
              </p>
            </Sheet>
          )}
        </Reveal>

        {snapshot?.generatedAt ? (
          <p className="num mt-3 text-[0.78rem] text-ink-faint">
            数据更新于 {snapshot.generatedAt.slice(0, 10)}；每次站点部署都会重新抓取。
          </p>
        ) : null}
      </section>
    </>
  )
}