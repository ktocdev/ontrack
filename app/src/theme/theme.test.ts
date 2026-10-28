import { describe, expect, it } from 'vitest'
import { applyTheme, readStoredPreference, resolveTheme, THEME_STORAGE_KEY, writeStoredPreference } from './theme'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

describe('resolveTheme', () => {
  it('follows the system when preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('ignores the system when a preference is set', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('stored preference', () => {
  it('defaults to system when nothing or garbage is stored', () => {
    expect(readStoredPreference(memoryStorage())).toBe('system')
    expect(readStoredPreference(memoryStorage({ [THEME_STORAGE_KEY]: 'blue' }))).toBe('system')
    expect(readStoredPreference(undefined)).toBe('system')
  })
  it('round-trips light and dark and clears on system', () => {
    const s = memoryStorage()
    writeStoredPreference(s, 'dark')
    expect(readStoredPreference(s)).toBe('dark')
    writeStoredPreference(s, 'system')
    expect(s.map.has(THEME_STORAGE_KEY)).toBe(false)
  })
  it('survives a storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readStoredPreference(throwing)).toBe('system')
    expect(() => writeStoredPreference(throwing, 'dark')).not.toThrow()
  })
})

describe('applyTheme', () => {
  it('sets data-theme and the theme-color meta', () => {
    document.head.innerHTML = '<meta name="theme-color" content="">'
    applyTheme(document, 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#121716')
    applyTheme(document, 'light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
