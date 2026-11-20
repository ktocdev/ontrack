import { useSyncExternalStore } from 'react'

function useMinWidth(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia?.(query)
      mql?.addEventListener('change', onChange)
      return () => mql?.removeEventListener('change', onChange)
    },
    () => !!window.matchMedia?.(query).matches,
    () => false,
  )
}

/**
 * Whether the screen is 768 px or wider (md), where the sidebar replaces the tab bar
 * (OT-157). For what must not be on the page at all on a phone, not only hidden by CSS:
 * hidden text still matches a search for it, and the sidebar's reads would load for nothing.
 */
export function useWide() {
  return useMinWidth('(min-width: 48rem)')
}

/** Whether the screen is 1024 px or wider (lg), where a list opens its item beside it (OT-159). */
export function useLaptop() {
  return useMinWidth('(min-width: 64rem)')
}
