import type { ComponentType, ReactNode } from 'react'
import { NavLink } from 'react-router'

/**
 * Desktop sidebar: the laptop-and-up stand-in for the bottom tab bar. Hidden
 * below the lg breakpoint, sidebar-w wide, a 1px right border, its own scroll.
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
    <aside className="hidden w-sidebar flex-none flex-col gap-6 overflow-y-auto border-r border-border px-4 pb-6 pt-8 lg:flex">
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

/** A route in the sidebar; takes the same items as TabBar. */
export function SidebarLink({
  to,
  end,
  icon: Icon,
  children,
}: {
  to: string
  end?: boolean
  icon?: ComponentType<{ size?: number }>
  children: ReactNode
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `${ITEM} ${isActive ? CURRENT : IDLE}`}>
      {Icon && <Icon size={22} />}
      {children}
    </NavLink>
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
