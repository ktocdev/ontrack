import type { ReactNode } from 'react'

/**
 * The middle of an empty screen: a 64px disc, 20 or 22px title as the board has it,
 * 14px body capped at 290px, then an action up to 260px wide. The disc is brand-tinted
 * when nothing is wrong and neutral when the list is empty because of a search.
 */
export function EmptyState({
  icon,
  title,
  body,
  tone = 'brand',
  titleSize = 22,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  body: ReactNode
  tone?: 'brand' | 'neutral'
  titleSize?: 20 | 22
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-7 pb-10 pt-6 text-center">
      <span
        className={`mb-1.5 flex h-16 w-16 items-center justify-center rounded-full ${
          tone === 'brand' ? 'bg-brand-tint text-brand' : 'bg-surface-muted text-text-secondary'
        }`}
      >
        {icon}
      </span>
      <h2
        className={`font-display font-bold tracking-[-0.01em] text-text [overflow-wrap:anywhere] ${
          titleSize === 20 ? 'text-20' : 'text-22'
        }`}
      >
        {title}
      </h2>
      <p className="max-w-[290px] text-14 leading-normal text-text-secondary">{body}</p>
      {children && <div className="mt-2.5 w-full max-w-[260px]">{children}</div>}
    </div>
  )
}
