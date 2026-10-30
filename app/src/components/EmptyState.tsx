import type { ReactNode } from 'react'

/**
 * The middle of an empty screen: a 64px brand-tint disc, 22px title, 14px body
 * capped at 290px, then an action up to 260px wide.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  body: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-7 pb-10 pt-6 text-center">
      <span className="mb-1.5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand">
        {icon}
      </span>
      <h2 className="font-display text-22 font-bold tracking-[-0.01em] text-text">{title}</h2>
      <p className="max-w-[290px] text-14 leading-normal text-text-secondary">{body}</p>
      {children && <div className="mt-2.5 w-full max-w-[260px]">{children}</div>}
    </div>
  )
}
