import type { ComponentType } from 'react'
import { NavLink } from 'react-router'

/**
 * The bottom tab bar: white, 1px top border, 6px 8px 20px padding plus the
 * home-bar inset on device. Each tab is a 44px column with a 24px icon and a
 * 12px label; the active tab is brand green.
 */
export type TabItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
  /** Match the active state on the route prefix (default) or exactly. */
  end?: boolean
}

export function TabBar({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="flex flex-none border-t border-border bg-surface px-2 pt-1.5"
      style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}
    >
      {items.map(({ to, label: text, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-tap flex-1 flex-col items-center gap-[3px] py-1.5 text-12 font-semibold ${
              isActive ? 'text-brand' : 'text-text-muted hover:text-text-muted'
            }`
          }
        >
          <Icon size={24} />
          {text}
        </NavLink>
      ))}
    </nav>
  )
}
