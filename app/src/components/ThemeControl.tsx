import type { ThemePreference } from '../theme/theme'
import { useTheme } from '../theme/useTheme'
import { Segmented } from './Segmented'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** System / Light / Dark, saved per device. Profile and /kit both use it. */
export function ThemeControl({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme()
  return <Segmented label="Theme" value={preference} onChange={setPreference} options={OPTIONS} className={className} />
}
