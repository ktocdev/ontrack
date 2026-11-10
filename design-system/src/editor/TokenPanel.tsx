import { useEffect, useState } from 'react'
import { useTheme } from '@app/theme/useTheme'
import { editCount } from '../tokens/editor'
import { useTokens } from '../tokens/store'
import { ColorTab } from './ColorTab'
import { ExportTab } from './ExportTab'
import { ShadowTab, ShapeTab, SpaceTab, TypeTab } from './OtherTabs'

/**
 * The token editor: a panel that slides in from the right (a sheet from the bottom on a
 * phone). Color and shadow edit the theme the page shows, so switching to dark edits dark;
 * type, shape and space are shared by both themes.
 */

const TABS = [
  { id: 'color', label: 'Color', perTheme: true },
  { id: 'type', label: 'Type', perTheme: false },
  { id: 'shape', label: 'Shape', perTheme: false },
  { id: 'shadow', label: 'Shadow', perTheme: true },
  { id: 'space', label: 'Space', perTheme: false },
  { id: 'export', label: 'Export', perTheme: false },
] as const
type TabId = (typeof TABS)[number]['id']

const TAB_KEY = 'ontrack-ds.tab'

export function TokenPanel() {
  const { panelOpen, setPanelOpen, edits } = useTokens()
  const { theme } = useTheme()
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      return TABS.some((t) => t.id === saved) ? (saved as TabId) : 'color'
    } catch {
      return 'color'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch {
      // per-visit only
    }
  }, [tab])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, setPanelOpen])

  const current = TABS.find((t) => t.id === tab)!
  const themeCount = editCount(edits, theme)

  return (
    <aside
      id="token-panel"
      aria-label="Token editor"
      aria-hidden={!panelOpen}
      inert={!panelOpen}
      className={`fixed inset-x-0 bottom-0 z-20 flex h-[82dvh] flex-col rounded-t-[18px] border border-ds-line bg-ds-panel shadow-ds transition-transform duration-200 ease-out sm:inset-x-auto sm:top-14 sm:right-0 sm:h-auto sm:w-[420px] sm:rounded-none sm:border-y-0 sm:border-r-0 ${panelOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}`}
    >
      <div className="flex flex-none items-center gap-3 border-b border-ds-line px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="font-ds-display text-20 font-bold text-ds-ink">Tokens</h2>
          <span className="text-12 text-ds-muted">
            {current.perTheme ? (
              <>
                Editing the <b className="font-semibold text-ds-ink">{theme === 'dark' ? 'dark' : 'light'} theme</b>
                {themeCount > 0 && ` · ${themeCount} changed`}. Switch theme at the top to edit the other.
              </>
            ) : tab === 'export' ? (
              'Download, copy or reset.'
            ) : (
              'Shared by light and dark.'
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Close token editor"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-ds-muted hover:bg-ds-sunken hover:text-ds-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Token groups"
        className="flex flex-none gap-1 overflow-x-auto border-b border-ds-line px-3 py-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="token-tabpanel"
            onClick={() => setTab(t.id)}
            className={`h-9 flex-none rounded-[8px] px-3 text-13 font-semibold transition-colors ${tab === t.id ? 'bg-ds-accent-soft text-ds-accent' : 'text-ds-muted hover:bg-ds-sunken hover:text-ds-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id="token-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
      >
        {tab === 'color' && <ColorTab theme={theme} />}
        {tab === 'type' && <TypeTab />}
        {tab === 'shape' && <ShapeTab />}
        {tab === 'shadow' && <ShadowTab theme={theme} />}
        {tab === 'space' && <SpaceTab />}
        {tab === 'export' && <ExportTab theme={theme} />}
      </div>
    </aside>
  )
}
