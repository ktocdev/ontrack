import type { HTMLAttributes, ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { IconChevronLeft, IconClose } from './icons'

/**
 * Screen layout primitives. A Screen fills the viewport column; the body
 * scrolls; headers and tab bars stay put. Side padding is the 20px screen
 * token; fixed chrome adds the safe-area insets.
 */

export function Screen({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-bg text-text ${className}`} {...rest}>
      {children}
    </div>
  )
}

/**
 * Scrolling content area. It is `relative` so absolutely positioned children
 * (sr-only labels, overlays) are placed inside the scroller; without it they
 * resolve against the page, stretch the document and add a second scrollbar.
 */
export function ScreenBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto px-screen ${className}`} {...rest}>
      {children}
    </div>
  )
}

type HeaderProps = {
  title: ReactNode
  /** Row above the title: restaurant name on the left, avatar on the right. */
  topLeft?: ReactNode
  topRight?: ReactNode
  /** Action beside the title (the Invite button, Add). */
  action?: ReactNode
  /** Tabs or search rendered under the title, inside the padded header. */
  children?: ReactNode
  className?: string
}

/** Title block: 20px top padding, 14px gaps, 30px Archivo title. */
export function ScreenHeader({ title, topLeft, topRight, action, children, className = '' }: HeaderProps) {
  return (
    <header className={`flex flex-none flex-col gap-3.5 px-screen pb-3 pt-safe ${className}`}>
      {(topLeft || topRight) && (
        <div className="mt-5 flex min-h-tap items-center justify-between">
          <div className="flex min-w-0 items-center">{topLeft}</div>
          {topRight}
        </div>
      )}
      <div className={`flex items-center justify-between ${topLeft || topRight ? '' : 'mt-5'}`}>
        <h1 className="font-display text-30 font-bold tracking-[-0.02em]">{title}</h1>
        {action}
      </div>
      {children}
    </header>
  )
}

/** Back bar for detail screens: 44px back target, a crumb, bottom divider. */
export function BackBar({ to, label, children }: { to: string; label: string; children?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-none items-center gap-1 border-b border-border px-3 pb-2 pt-safe">
      <Link
        to={to}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconChevronLeft />
      </Link>
      <div className="min-w-0 text-13 font-semibold leading-snug text-text-muted">{children}</div>
    </div>
  )
}

/**
 * Title bar for a pushed screen (Profile, Help): 44px back target and a 20px
 * Archivo title on one line, 1px bottom border. 12px 20px 8px 8px padding.
 */
export function TitleBar({ to, label, title }: { to: string; label: string; title: ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-5 pt-[calc(12px+var(--safe-top))]">
      <Link
        to={to}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconChevronLeft size={22} />
      </Link>
      <h1 className="font-display text-20 font-bold">{title}</h1>
    </div>
  )
}

/**
 * Header for a full-screen form opened from a list (Add restaurant): 24px
 * Archivo title on the left, a 44px close target on the right, 1px bottom
 * border. 12px 12px 8px 20px padding.
 */
export function CloseBar({ to, title, label = 'Close' }: { to: string; title: ReactNode; label?: string }) {
  return (
    <div className="flex flex-none items-center justify-between border-b border-border pb-2 pl-5 pr-3 pt-[calc(12px+var(--safe-top))]">
      <h1 className="font-display text-24 font-bold tracking-[-0.02em]">{title}</h1>
      <Link
        to={to}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconClose />
      </Link>
    </div>
  )
}

/** Fixed action bar under a scrolling form ("Save changes"): 1px top border, 12px 20px 24px. */
export function ScreenFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2.5 border-t border-border px-screen pb-[max(24px,var(--safe-bottom))] pt-3">
      {children}
    </div>
  )
}

/** Underline tabs ("Open · 14 | Closed"): 44px, 14 or 15px semibold, brand underline. */
export function UnderlineTabs({
  items,
  label,
  size = 'md',
}: {
  items: { to: string; label: ReactNode; end?: boolean }[]
  label: string
  size?: 'md' | 'lg'
}) {
  return (
    <nav aria-label={label} className="flex border-b border-border">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `-mb-px flex min-h-tap flex-1 items-center justify-center gap-1.5 border-b-2 font-semibold ${
              size === 'lg' ? 'text-15' : 'text-14'
            } ${isActive ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'} transition-colors active:bg-surface-hover active:duration-0`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Section eyebrow with the design's 16px top spacing. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`eyebrow block pt-4 ${className}`}>{children}</span>
}
