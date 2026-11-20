import type { ComponentType, ReactNode } from 'react'
import { Link, useLocation, useMatch } from 'react-router'

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
  /** Addresses outside the tab's own path that still light it: a ticket opened from its list (OT-159). */
  lightsOn?: RegExp
}

/** Whether a tab is the current one: its own path, or an address it lights on. */
export function useTabLit({ to, end, also, lightsOn }: Pick<TabItem, 'to' | 'end' | 'also' | 'lightsOn'>) {
  const { pathname } = useLocation()
  const own = useMatch({ path: to, end: !!end && pathname !== also })
  return !!own || !!lightsOn?.test(pathname)
}

export function TabBar({
  items,
  label,
  inset = true,
  inert = false,
  phoneOnly = false,
}: {
  items: TabItem[]
  label: string
  /** Use the home-bar inset. Only the bar pinned to the bottom edge wants it; /kit samples turn it off. */
  inset?: boolean
  /** Shown but not links, with the first home tab lit (View as). */
  inert?: boolean
  /** Hidden from 768 px, where the sidebar takes its place (OT-157). /kit samples show it at every width. */
  phoneOnly?: boolean
}) {
  return (
    <nav
      aria-label={label}
      data-testid="tab-bar"
      className={`flex flex-none border-t border-border bg-surface px-2 pt-1.5 ${phoneOnly ? 'md:hidden' : ''}`}
      style={{ paddingBottom: inset ? 'max(8px, var(--safe-bottom))' : '8px' }}
    >
      {items.map(({ to, label: text, icon: Icon, end, also, lightsOn }) =>
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
          <TabLink key={to} to={to} end={end} also={also} lightsOn={lightsOn}>
            <Icon size={24} />
            {text}
          </TabLink>
        ),
      )}
    </nav>
  )
}

function TabLink({ children, ...item }: Pick<TabItem, 'to' | 'end' | 'also' | 'lightsOn'> & { children: ReactNode }) {
  const lit = useTabLit(item)
  return (
    <Link
      to={item.to}
      aria-current={lit ? 'page' : undefined}
      className={`flex min-h-tap flex-1 flex-col items-center gap-[3px] rounded-control py-1.5 text-12 font-semibold transition-colors active:bg-surface-muted active:duration-0 ${
        lit ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </Link>
  )
}
