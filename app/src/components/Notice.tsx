import type { ReactNode } from 'react'
import { IconCheck, IconInfo, IconStatusWaiting, IconWarning } from './icons'

/**
 * Inline confirmation inside a form ("Profile saved."): brand-tint-soft
 * panel, 12px radius, 10px 12px padding, 13px brand-strong text with a check.
 * Announced through role="status". For a message that outlives the screen,
 * use the toast instead.
 */
export function Notice({
  tone = 'brand',
  children,
  className = '',
}: {
  /**
   * 'waiting' is for something now with someone else (Reopened and sent to Ops); 'info'
   * is a note that stays on a screen (Closed tickets also appear on each unit); 'warn' is
   * something to weigh before going on (checks still to do before submitting a walkthrough).
   */
  tone?: 'brand' | 'waiting' | 'info' | 'warn'
  children: ReactNode
  className?: string
}) {
  if (tone === 'info') {
    return (
      <div
        className={`flex flex-none items-start gap-2.5 rounded-input bg-brand-tint-soft px-3 py-2.5 text-13 leading-[1.45] text-brand-strong ${className}`}
      >
        <IconInfo size={18} className="mt-px flex-none" />
        <span>{children}</span>
      </div>
    )
  }
  if (tone === 'warn') {
    return (
      <div
        role="status"
        className={`flex flex-none items-start gap-2.5 rounded-input border border-reopened-banner-border bg-reopened-banner-bg px-3.5 py-3 text-13 leading-[1.45] text-reopened-banner-text ${className}`}
      >
        <IconWarning size={18} className="mt-px flex-none" />
        <span>{children}</span>
      </div>
    )
  }
  if (tone === 'waiting') {
    return (
      <div
        role="status"
        className={`flex flex-none items-start gap-2.5 rounded-input bg-status-waiting-bg px-3 py-2.5 text-13 leading-[1.45] text-status-waiting-text ${className}`}
      >
        <IconStatusWaiting size={18} className="mt-px flex-none" />
        <span>{children}</span>
      </div>
    )
  }
  return (
    <div
      role="status"
      className={`flex flex-none items-center gap-2.5 rounded-input bg-brand-tint-soft px-3 py-2.5 text-13 text-brand-strong ${className}`}
    >
      <IconCheck size={18} strokeWidth={2.4} className="flex-none" />
      <span>{children}</span>
    </div>
  )
}

/**
 * Why a form didn't save (Error-Save-Failed): the open status tint, 12px radius,
 * 13px text with a bold lead. Announced through role="alert".
 */
export function ErrorBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-none items-start gap-2.5 rounded-input bg-status-open-bg px-3 py-2.5 text-13 leading-[1.45] text-status-open-text"
    >
      <IconWarning size={18} className="mt-px flex-none" />
      <span>
        <b>{title}</b> {children}
      </span>
    </div>
  )
}
