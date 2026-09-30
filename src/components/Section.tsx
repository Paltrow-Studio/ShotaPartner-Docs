import type { ReactNode } from 'react'

/** 分区外壳：统一的纵向节奏与 id 锚点 */
export function Section({
  id,
  children,
  className = '',
  bleed = false,
}: {
  id: string
  children: ReactNode
  className?: string
  bleed?: boolean
}) {
  return (
    <section id={id} className={`relative scroll-mt-24 py-20 sm:py-24 ${className}`}>
      {bleed ? children : <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">{children}</div>}
    </section>
  )
}

/** 分区标题 */
export function SectionHeading({
  eyebrow,
  title,
  desc,
  align = 'left',
}: {
  eyebrow: string
  title: ReactNode
  desc?: ReactNode
  align?: 'left' | 'center'
}) {
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left'
  return (
    <div className={`flex max-w-3xl flex-col gap-4 ${alignment} ${align === 'center' ? 'mx-auto' : ''}`}>
      <span className="pill chip-mono uppercase tracking-[0.18em] text-violet-300/90">{eyebrow}</span>
      <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h2>
      {desc ? <p className="text-base leading-relaxed text-slate-400 sm:text-[1.05rem]">{desc}</p> : null}
    </div>
  )
}
