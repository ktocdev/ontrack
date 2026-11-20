import type { ComponentType, ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import type { AppRole } from '../lib/supabase'
import { Avatar } from './Avatar'
import { Logo } from './icons'

/**
 * Sidebar: the tablet-and-up stand-in for the bottom tab bar (OT-157). Hidden
 * below the md breakpoint (768), sidebar-w wide, a 1px right border, its own scroll.
 * Items are 44px rows, 14px semibold; the current one sits on brand-tint-soft
 * in brand. Page layouts put it beside a Screen inside a max-w-desktop row.
 */
export function Sidebar({
  label,
  header,
  footer,
  children,
}: {
  label: string
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <aside className="hidden w-sidebar flex-none flex-col gap-6 overflow-y-auto border-r border-border px-4 pb-[calc(24px+var(--safe-bottom))] pt-[calc(32px+var(--safe-top))] md:flex">
      {header && <div className="px-3">{header}</div>}
      <nav aria-label={label} className="flex flex-col gap-0.5">
        {children}
      </nav>
      {footer && <div className="mt-auto px-3">{footer}</div>}
    </aside>
  )
}

const ITEM =
  'flex min-h-tap items-center gap-3 rounded-control px-3 text-14 font-semibold transition-colors active:duration-0'
const IDLE = 'text-text-secondary hover:bg-surface-hover hover:text-text active:bg-surface-muted'
const CURRENT = 'bg-brand-tint-soft text-brand hover:text-brand active:bg-brand-tint'

/**
 * A route in the sidebar; takes the same items as TabBar, `also` included. Inert (View as)
 * shows it with no link, lit when `current` says so.
 */
export function SidebarLink({
  to,
  end,
  also,
  icon: Icon,
  inert = false,
  current = false,
  children,
}: {
  to: string
  end?: boolean
  also?: string
  icon?: ComponentType<{ size?: number }>
  inert?: boolean
  current?: boolean
  children: ReactNode
}) {
  const { pathname } = useLocation()
  if (inert) {
    return (
      <span
        aria-current={current ? 'page' : undefined}
        className={`${ITEM} ${current ? 'bg-brand-tint-soft text-brand' : 'text-text-muted'}`}
      >
        {Icon && <Icon size={22} />}
        {children}
      </span>
    )
  }
  return (
    <NavLink
      to={to}
      end={end && pathname !== also}
      className={({ isActive }) => `${ITEM} ${isActive ? CURRENT : IDLE}`}
    >
      {Icon && <Icon size={22} />}
      {children}
    </NavLink>
  )
}

/** The sidebar's head: the mark, OnTrack and the group's name under it. */
export function SidebarBrand({ group }: { group: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={32} />
      <div className="flex min-w-0 flex-col">
        <span className="font-display text-17 font-bold leading-tight">OnTrack</span>
        {group && <span className="truncate text-12 text-text-muted">{group}</span>}
      </div>
    </div>
  )
}

/**
 * The sidebar's foot: who is signed in, as a 44px row with the 40px avatar, the name and
 * the job title (else the role name) under it. It opens Profile; under View as it is no link.
 */
export function SidebarProfile({
  to,
  name,
  role,
  subtitle,
  src,
  inert = false,
}: {
  to: string
  name: string
  role: AppRole
  subtitle?: string
  src?: string
  inert?: boolean
}) {
  const body = (
    <>
      <Avatar name={name} role={role} src={src} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-14 font-semibold text-text">{name}</span>
        {subtitle && <span className="truncate text-12 text-text-muted">{subtitle}</span>}
      </span>
    </>
  )
  const row = 'flex min-h-tap items-center gap-2.5 rounded-control px-2 py-1.5'
  if (inert) return <div className={row}>{body}</div>
  return (
    <Link
      to={to}
      aria-label="Your profile"
      className={`${row} no-underline transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {body}
    </Link>
  )
}

/** An in-page jump (the kit's sections). */
export function SidebarAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={`${ITEM} ${IDLE}`}>
      {children}
    </a>
  )
}
