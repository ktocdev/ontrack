import type { ReactNode } from 'react'

/**
 * The shared middle of every error screen: eyebrow code, 64px icon disc,
 * 22px title, 14px body capped at 290px, then whatever actions follow.
 */
export function ErrorBlock({
  code,
  icon,
  title,
  body,
  tone = 'neutral',
  children,
  role,
}: {
  code: string
  icon: ReactNode
  title: ReactNode
  body: ReactNode
  tone?: 'neutral' | 'danger'
  children?: ReactNode
  role?: 'alert'
}) {
  return (
    <div role={role} className="flex flex-1 flex-col items-center justify-center gap-2.5 px-7 pb-10 pt-6 text-center">
      <span className="text-12 font-semibold uppercase tracking-[.06em] text-text-secondary">{code}</span>
      <span
        className={`mb-1.5 flex h-16 w-16 items-center justify-center rounded-full ${
          tone === 'danger' ? 'bg-status-open-bg text-status-open-text' : 'bg-surface-muted text-text-secondary'
        }`}
      >
        {icon}
      </span>
      <h1 className="font-display text-22 font-bold tracking-[-0.01em] text-text">{title}</h1>
      <p className="max-w-[290px] text-14 leading-normal text-text-secondary">{body}</p>
      {children}
    </div>
  )
}
