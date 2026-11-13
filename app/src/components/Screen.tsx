import type { ComponentPropsWithRef, HTMLAttributes, ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { IconChevronLeft, IconClose, Logo } from './icons'

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
export function ScreenBody({ className = '', children, ...rest }: ComponentPropsWithRef<'div'>) {
  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto px-screen ${className}`} {...rest}>
      {children}
    </div>
  )
}

/**
 * Room for an EmptyState that sits under a header instead of inside a ScreenBody. It
 * scrolls when the state doesn't fit, as under a tall header on a short phone, where
 * its button would otherwise end up behind the tab bar; when it fits, nothing changes.
 */
export function ScreenEmpty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
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
      <div className={`flex items-center justify-between gap-3 ${topLeft || topRight ? '' : 'mt-5'}`}>
        <h1 className="font-display text-30 font-bold tracking-[-0.02em]">{title}</h1>
        {action}
      </div>
      {children}
    </header>
  )
}

/**
 * Back bar for detail screens: 44px back target, a crumb, bottom divider. The Create form
 * draws it with no line. Roomy adds the 12px above a two-line header (Service record:
 * the unit and restaurant over the title).
 */
export function BackBar({
  to,
  label,
  bordered = true,
  roomy = false,
  action,
  children,
}: {
  to: string
  label: string
  bordered?: boolean
  roomy?: boolean
  /** A link at the right end (Edit on a unit's page). */
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      className={`flex flex-none items-center gap-1 px-3 ${
        bordered
          ? `mb-2 border-b border-border pb-2 ${roomy ? 'pt-[calc(12px+var(--safe-top))]' : 'pt-safe'}`
          : 'pb-1 pt-[calc(12px+var(--safe-top))]'
      }`}
    >
      <Link
        to={to}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconChevronLeft />
      </Link>
      <div className="min-w-0 flex-1 text-13 font-semibold leading-snug text-text-muted">{children}</div>
      {action}
    </div>
  )
}

/**
 * Back bar for the signed-out reset screens: 44px back target, the 24px mark and
 * a 17px name, bottom divider. 12px 12px 8px padding, 8px below.
 */
export function BrandBackBar({ to, label, state }: { to: string; label: string; state?: unknown }) {
  return (
    <div className="mb-2 flex flex-none items-center gap-1 border-b border-border pb-2 pl-3 pr-3 pt-[calc(12px+var(--safe-top))]">
      <Link
        to={to}
        state={state}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconChevronLeft size={22} />
      </Link>
      <Logo size={24} />
      <span className="ml-1 font-display text-17 font-bold">OnTrack</span>
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
 * border. 12px 12px 8px 20px padding. Invite user draws it with no border or
 * bottom padding. With a subtitle (Log service: "OT-1042 · Walk-in Cooler 1") the title
 * is 22px with the 12px line under it, 2px apart.
 */
export function CloseBar({
  to,
  title,
  subtitle,
  label = 'Close',
  bordered = true,
}: {
  to: string
  title: ReactNode
  subtitle?: ReactNode
  label?: string
  bordered?: boolean
}) {
  return (
    <div
      className={`flex flex-none items-center justify-between pl-5 pr-3 pt-[calc(12px+var(--safe-top))] ${bordered ? 'border-b border-border pb-2' : ''}`}
    >
      {subtitle ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-22 font-bold tracking-[-0.02em]">{title}</h1>
          <span className="truncate text-12 text-text-secondary">{subtitle}</span>
        </div>
      ) : (
        <h1 className="font-display text-24 font-bold tracking-[-0.02em]">{title}</h1>
      )}
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
  inert = false,
  className = '',
}: {
  items: { to: string; label: ReactNode; end?: boolean }[]
  label: string
  size?: 'md' | 'lg'
  /** Shown but not links, with the first tab lit (View as). */
  inert?: boolean
  className?: string
}) {
  const text = size === 'lg' ? 'text-15' : 'text-14'
  if (inert) {
    return (
      <nav aria-label={label} className={`flex border-b border-border ${className}`}>
        {items.map((t, i) => (
          <span
            key={t.to}
            aria-current={i === 0 ? 'page' : undefined}
            className={`-mb-px flex min-h-tap flex-1 items-center justify-center gap-1.5 border-b-2 font-semibold ${text} ${
              i === 0 ? 'border-brand text-text' : 'border-transparent text-text-muted'
            }`}
          >
            {t.label}
          </span>
        ))}
      </nav>
    )
  }
  return (
    <nav aria-label={label} className={`flex border-b border-border ${className}`}>
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `-mb-px flex min-h-tap flex-1 items-center justify-center gap-1.5 border-b-2 font-semibold ${text} ${isActive ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'} transition-colors active:bg-surface-hover active:duration-0`
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
