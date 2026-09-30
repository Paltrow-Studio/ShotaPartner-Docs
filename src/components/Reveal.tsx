import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

/**
 * 滚动进场包装组件：元素进入视口后加 .is-visible 触发淡入上移。
 * 用 IntersectionObserver，避免滚动事件里的重复计算。
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as,
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: ElementType
}) {
  const Tag = as ?? 'div'
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
