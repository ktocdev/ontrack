import type { ReactNode } from 'react'
import { IconCheck } from './icons'

/**
 * Inline confirmation inside a form ("Profile saved."): brand-tint-soft
 * panel, 12px radius, 10px 12px padding, 13px brand-strong text with a check.
 * Announced through role="status". For a message that outlives the screen,
 * use the toast instead.
 */
export function Notice({ children, className = '' }: { children: ReactNode; className?: string }) {
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
