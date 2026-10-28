import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from './theme'

export type ThemeContextValue = {
  preference: ThemePreference
  theme: ResolvedTheme
  setPreference: (next: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
