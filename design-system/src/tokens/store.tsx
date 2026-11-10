import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { emptyEdits, normalizeEdits, overrideCss, type Edits } from './editor'
import { ensureFontLoaded, fontById } from './fonts'
import { parseColor, type Rgba } from './color'

/**
 * The editor's state for the whole site. Edits are saved in this browser only (a draft,
 * not a source of truth: Export is how they reach the app) and applied as one stylesheet
 * injected after the app's tokens.css, so every demo, sheet and menu picks them up.
 */

const STORAGE_KEY = 'ontrack-ds.edits.v1'
const STYLE_ID = 'ds-token-overrides'

type Ctx = {
  edits: Edits
  update: (fn: (draft: Edits) => void) => void
  replace: (next: Edits) => void
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  /** Bumps after the overrides or the theme change, for anything that reads computed colors. */
  revision: number
}

const TokenContext = createContext<Ctx | null>(null)

function load(): Edits {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeEdits(JSON.parse(saved)) : emptyEdits()
  } catch {
    return emptyEdits()
  }
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<Edits>(load)
  const [panelOpen, setPanelOpen] = useState(false)
  const [revision, setRevision] = useState(0)

  // Before paint, so a changed value never flashes the old one.
  useLayoutEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
    }
    // Last in <head>, after Vite's own stylesheets, so equal selectors resolve to these.
    document.head.appendChild(el)
    el.textContent = overrideCss(edits)
    for (const id of Object.values(edits.fonts)) {
      const font = id ? fontById(id) : undefined
      if (font) ensureFontLoaded(font)
    }
    setRevision((r) => r + 1)
  }, [edits])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(edits))
    } catch {
      // Private windows and blocked storage: the edits still apply for this visit.
    }
  }, [edits])

  // The theme lives on <html data-theme>; computed colors change with it.
  useEffect(() => {
    const observer = new MutationObserver(() => setRevision((r) => r + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const update = useCallback((fn: (draft: Edits) => void) => {
    setEdits((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])
  const replace = useCallback((next: Edits) => setEdits(normalizeEdits(next)), [])

  const value = useMemo(
    () => ({ edits, update, replace, panelOpen, setPanelOpen, revision }),
    [edits, update, replace, panelOpen, revision],
  )
  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>
}

export function useTokens() {
  const ctx = useContext(TokenContext)
  if (!ctx) throw new Error('useTokens must be used inside <TokenProvider>')
  return ctx
}

let probe: HTMLSpanElement | null = null

/**
 * What a token actually paints as right now, color-mix() and var() included, read from a
 * hidden element. Pass `revision` from useTokens() as a dependency so it rereads.
 */
export function computedColor(name: string): Rgba | null {
  if (typeof document === 'undefined') return null
  if (!probe) {
    probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    probe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(probe)
  }
  probe.style.color = `var(--${name})`
  return parseColor(getComputedStyle(probe).color)
}

/** The theme the page shows now, read from <html>. */
export function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
