import type { ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router'

/**
 * The bottom tab bar: white, 1px top border, 6px 8px on top and sides. The
 * design's 20px bottom is its allowance for the home bar, so on device the
 * real inset replaces it, never less than 8px (adding both left about 60px
 * under the labels on an iPhone). Each tab is a 44px column with a 24px icon
 * and a 12px label; the active tab is brand green.
 */
export type TabItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
  /** Match the active state on the route prefix (default) or exactly. */
  end?: boolean
  /** A route under this tab that `end` would otherwise leave out (In-house under Open tickets). */
  also?: string
}

export function TabBar({
  items,
  label,
  inset = true,
  inert = false,
}: {
  items: TabItem[]
  label: string
  /** Use the home-bar inset. Only the bar pinned to the bottom edge wants it; /kit samples turn it off. */
  inset?: boolean
  /** Shown but not links, with the first home tab lit (View as). */
  inert?: boolean
}) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label={label}
      className="flex flex-none border-t border-border bg-surface px-2 pt-1.5"
      style={{ paddingBottom: inset ? 'max(8px, var(--safe-bottom))' : '8px' }}
    >
      {items.map(({ to, label: text, icon: Icon, end, also }) =>
        inert ? (
          <span
            key={to}
            aria-current={end ? 'page' : undefined}
            className={`flex min-h-tap flex-1 flex-col items-center gap-[3px] py-1.5 text-12 font-semibold ${end ? 'text-brand' : 'text-border-muted'}`}
          >
            <Icon size={24} />
            {text}
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={end && pathname !== also}
            className={({ isActive }) =>
              `flex min-h-tap flex-1 flex-col items-center gap-[3px] rounded-control py-1.5 text-12 font-semibold transition-colors active:bg-surface-muted active:duration-0 ${
                isActive ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Icon size={24} />
            {text}
          </NavLink>
        ),
      )}
    </nav>
  )
}
