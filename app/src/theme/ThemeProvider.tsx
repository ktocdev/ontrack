import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext } from './context'
import { applyTheme, readStoredPreference, resolveTheme, writeStoredPreference, type ThemePreference } from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(typeof localStorage === 'undefined' ? undefined : localStorage),
  )
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const theme = resolveTheme(preference, prefersDark)

  useEffect(() => {
    applyTheme(document, theme)
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writeStoredPreference(typeof localStorage === 'undefined' ? undefined : localStorage, next)
  }, [])

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
