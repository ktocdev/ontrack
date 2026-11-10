import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '@app/components/icons'
import { useTheme } from '@app/theme/useTheme'
import type { ThemePreference } from '@app/theme/theme'
import { editCount } from '../tokens/editor'
import { useTokens } from '../tokens/store'
import { TokenPanel } from '../editor/TokenPanel'
import { NAV } from '../pages/registry'

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { panelOpen } = useTokens()
  const { pathname, hash } = useLocation()

  useEffect(() => {
    setMenuOpen(false)
    if (!hash) window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <div className="flex min-h-dvh flex-col bg-ds-bg font-ds-body text-ds-ink">
      <TopBar onMenu={() => setMenuOpen((v) => !v)} menuOpen={menuOpen} />
      <div className="flex flex-1">
        <aside
          className={`${menuOpen ? 'fixed inset-x-0 top-14 bottom-0 z-10 block' : 'hidden'} overflow-y-auto border-r border-border bg-surface lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-56px)] lg:w-[264px] lg:flex-none`}
        >
          <SideNav />
        </aside>
        <main
          className={`min-w-0 flex-1 px-4 pt-10 pb-24 sm:px-8 lg:px-12 ${panelOpen ? 'xl:pr-[436px]' : ''} transition-[padding] duration-200`}
        >
          <div className="mx-auto max-w-[920px]">
            <Outlet />
          </div>
        </main>
      </div>
      <TokenPanel />
    </div>
  )
}

function TopBar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { edits, panelOpen, setPanelOpen } = useTokens()
  const count = editCount(edits)
  return (
    <header className="sticky top-0 z-20 flex h-14 flex-none items-center gap-3 border-b border-ds-line bg-ds-panel/95 px-3 backdrop-blur sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-control text-ds-ink hover:bg-ds-sunken lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <NavLink to="/" className="flex min-w-0 items-center gap-2.5 text-ds-ink! no-underline">
        <Logo size={26} />
        <span className="truncate font-ds-display text-17 font-bold tracking-[-0.01em]">
          OnTrack <span className="font-medium text-ds-muted">Design System</span>
        </span>
      </NavLink>
      <div className="ml-auto flex items-center gap-2">
        <ThemeSwitch />
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          aria-controls="token-panel"
          // The word hides on a phone; the name must not.
          aria-label={count > 0 ? `Tokens, ${count} edited` : 'Tokens'}
          className={`flex h-10 items-center gap-2 rounded-control px-3.5 text-14 font-semibold transition-colors ${panelOpen ? 'bg-ds-accent-fill text-ds-on-accent' : 'border border-ds-line-strong text-ds-ink hover:bg-ds-sunken'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
          <span className="hidden sm:inline">Tokens</span>
          {count > 0 && (
            <span
              aria-hidden
              className={`min-w-5 rounded-full px-1.5 text-center text-11 leading-5 font-bold ${panelOpen ? 'bg-ds-on-accent text-ds-accent-fill' : 'bg-ds-accent-fill text-ds-on-accent'}`}
            >
              {count}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

function ThemeSwitch() {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-control bg-ds-sunken p-[3px]">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={preference === t.value}
          onClick={() => setPreference(t.value)}
          className={`h-[34px] rounded-segment px-2.5 text-13 font-semibold transition-colors ${preference === t.value ? 'bg-ds-panel text-ds-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ds-muted hover:text-ds-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Like all the docs chrome, the sidebar is drawn in the app's tokens (see styles.css).
function SideNav() {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-6 px-3 py-6">
      {NAV.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <h2 className="mb-1.5 px-3 font-ds-body text-11 font-bold tracking-[0.08em] text-text-muted uppercase">
            {group.title}
          </h2>
          {group.pages.map((p) => (
            <NavLink
              key={p.path}
              to={p.path}
              end
              className={({ isActive }) =>
                `rounded-control px-3 py-[7px] text-14 no-underline transition-colors ${isActive ? 'bg-brand-tint-soft font-semibold text-brand!' : 'text-text-secondary! hover:bg-surface-muted hover:text-text!'}`
              }
            >
              {p.title}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
