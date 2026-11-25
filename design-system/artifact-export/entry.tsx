/* oxlint-disable react/only-export-components -- a bundle entry re-exports every module */
/* The OnTrack design system bundle: the app's own components, re-exported as window.OnTrack. */
import './entry.css'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { ToastProvider } from '@app/components/Toast'
import { ThemeContext } from '@app/theme/context'
import type { ThemePreference } from '@app/theme/theme'

export * from '@app/components/AccentPicker'
export * from '@app/components/AdminShield'
export * from '@app/components/Avatar'
export * from '@app/components/Button'
export * from '@app/components/Card'
export * from '@app/components/Checklist'
export * from '@app/components/Chip'
export * from '@app/components/ClosedTicketRow'
export * from '@app/components/CodeInput'
export * from '@app/components/ContractorCard'
export * from '@app/components/Cost'
export * from '@app/components/EmptyState'
export * from '@app/components/Equipment'
export * from '@app/components/Field'
export * from '@app/components/HiddenCategories'
export * from '@app/components/InstallSheet'
export * from '@app/components/Kpi'
export * from '@app/components/Menu'
export * from '@app/components/MonthStepper'
export * from '@app/components/Notice'
export * from '@app/components/OpsTicketCard'
export * from '@app/components/Photo'
export * from '@app/components/Pill'
export * from '@app/components/RadioCard'
export * from '@app/components/ReadOnlyBanner'
export * from '@app/components/ReorderList'
export * from '@app/components/RestaurantGroup'
export * from '@app/components/RestaurantName'
export { RestaurantPicker, RestaurantTitlePicker } from '@app/components/RestaurantPicker'
export * from '@app/components/Schedule'
export * from '@app/components/Screen'
export * from '@app/components/Segmented'
export * from '@app/components/Sheet'
export * from '@app/components/Sidebar'
export * from '@app/components/Skeleton'
export * from '@app/components/StatusMenu'
export * from '@app/components/Switch'
export * from '@app/components/TabBar'
export * from '@app/components/TaskRow'
export * from '@app/components/ThemeControl'
export * from '@app/components/Thread'
export * from '@app/components/TicketCard'
export * from '@app/components/TicketMenu'
export * from '@app/components/Toast'
export * from '@app/components/UpdateBar'
export * from '@app/components/ViewSetting'
export * from '@app/components/Walkthrough'
export * from '@app/components/icons'
export { ROLE_TABS } from '@app/app/roles'

function readTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/**
 * What the app gives every screen, for use outside the app: an in-memory router (the
 * components link with React Router), the toast host and a theme context that follows
 * the data-theme attribute on <html>. Wrap anything you render from this bundle in it.
 */
export function Frame({ children, initialPath = '/' }: { children: ReactNode; initialPath?: string }) {
  const [theme, setTheme] = useState(readTheme)
  const [preference, setPref] = useState<ThemePreference>(readTheme)
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  const value = useMemo(
    () => ({
      preference,
      theme,
      setPreference: (next: ThemePreference) => {
        setPref(next)
        const resolved =
          next === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next
        document.documentElement.setAttribute('data-theme', resolved)
      },
    }),
    [preference, theme],
  )
  return (
    <ThemeContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </ThemeContext.Provider>
  )
}
