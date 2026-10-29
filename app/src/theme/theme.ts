/**
 * Theme preference and resolution.
 *
 * The preference is one of 'system' | 'light' | 'dark', saved per device in
 * localStorage. 'system' follows prefers-color-scheme. The resolved theme is
 * written to <html data-theme="…"> so the CSS variables in tokens.css switch.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ontrack.theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function readStoredPreference(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

export function writeStoredPreference(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  preference: ThemePreference,
) {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY)
    else storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private mode or blocked storage: the preference just does not persist.
  }
}

export function applyTheme(doc: Document, theme: ResolvedTheme) {
  doc.documentElement.dataset.theme = theme
  // Keep the browser chrome (iOS status bar, Android toolbar) in step with the
  // screen background, read from the --bg token now that data-theme is set.
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const bg = doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--bg').trim()
  if (meta && bg) meta.content = bg
}
