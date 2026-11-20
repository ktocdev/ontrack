import { useSyncExternalStore } from 'react'

/** The md breakpoint: from here the sidebar replaces the tab bar (OT-157). */
const WIDE = '(min-width: 48rem)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia?.(WIDE)
  mql?.addEventListener('change', onChange)
  return () => mql?.removeEventListener('change', onChange)
}

const wide = () => !!window.matchMedia?.(WIDE).matches

/**
 * Whether the screen is 768 px or wider. For what must not be on the page at all on a
 * phone, not only hidden by CSS: hidden text still matches a search for it, and the
 * sidebar's reads (job titles, the avatar) would load for nothing.
 */
export function useWide() {
  return useSyncExternalStore(subscribe, wide, () => false)
}
