import type { ReactNode } from 'react'

/**
 * 极简行内标记：`code`、**重点**、[文字](链接)。
 * 用正则切片后映射成 React 元素，不用 dangerouslySetInnerHTML。
 */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter((p) => p !== '')
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="rounded-sm border border-line bg-paper-sunk px-1 py-[0.05rem] text-[0.84em]"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) {
          return (
            <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener" className="link-quiet">
              {link[1]}
            </a>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

/** 一张纸 */
export function Sheet({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div className={`sheet rounded-lg ${hover ? 'sheet-hover' : ''} ${className}`}>{children}</div>
  )
}

/** 章节标题：序号 + 标题 + 导语 */
export function ChapterHeading({
  mark,
  title,
  lede,
  id,
}: {
  mark: string
  title: string
  lede?: string
  id?: string
}) {
  return (
    <header className="relative">
      <div className="flex items-center gap-3">
        <span className="chapter-mark">{mark}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 id={id} className="mt-3 text-2xl sm:text-[1.7rem]">
        {title}
      </h2>
      {lede ? <p className="mt-2 max-w-3xl text-[0.95rem] text-ink-soft">{lede}</p> : null}
    </header>
  )
}

/** 提示框：像书页边上的批注 */
export function Note({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="border-l-2 border-l-line-strong bg-paper-sunk/60 py-3 pl-4 pr-3">
      <p className="text-[0.88rem] leading-relaxed text-ink-soft">
        <span className="mr-1 text-seal">※</span>
        {title ? <strong className="text-ink">{title}　</strong> : null}
        {children}
      </p>
    </aside>
  )
}
