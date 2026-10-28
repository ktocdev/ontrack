import { useAppUpdate } from './pwa/useAppUpdate'
import { useInstallPrompt } from './pwa/useInstallPrompt'
import { useTheme } from './theme/useTheme'
import type { ThemePreference } from './theme/theme'

/**
 * Phase 0 placeholder shell. It proves the foundation on a phone: tokens in both
 * themes, the theme toggle saved per device, the install path, and the update
 * prompt. The app frame, routing and role shells replace this in OT-3.
 */
export default function App() {
  const { preference, theme, setPreference } = useTheme()
  const install = useInstallPrompt()
  const update = useAppUpdate()

  return (
    <main className="flex flex-1 flex-col px-screen pt-safe pb-safe" data-testid="app-shell">
      <header className="flex items-center justify-between pt-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[17px] font-bold">OnTrack</span>
        </div>
        <span className="eyebrow">Phase 0</span>
      </header>

      <section className="mt-8 flex flex-col gap-4">
        <h1 className="text-30 font-bold tracking-[-0.02em]">Foundation</h1>
        <p className="text-15 text-text-secondary">
          Tokens, theme, install and update plumbing. Nothing a user would call a feature yet.
        </p>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="eyebrow mb-3">Theme</div>
          <ThemeSegment value={preference} onChange={setPreference} />
          <p className="mt-3 text-13 text-text-muted">
            Showing <span className="font-semibold text-text-body">{theme}</span>. Saved on this device.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="eyebrow mb-2">Install</div>
          <InstallRow state={install.state} onInstall={install.promptInstall} />
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="eyebrow mb-3">Swatches</div>
          <div className="grid grid-cols-4 gap-2" aria-hidden="true">
            {SWATCHES.map((s) => (
              <div key={s.name} className="flex flex-col gap-1">
                <div className={`h-9 rounded-control border border-border ${s.cls}`} />
                <span className="text-11 text-text-muted">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {update.needRefresh && (
        <div
          role="status"
          className="mt-auto mb-4 flex items-center justify-between gap-3 rounded-input bg-brand-strong px-4 py-3 text-on-brand"
        >
          <span className="text-14 font-semibold">A new version is ready.</span>
          <button className="min-h-tap rounded-control px-3 font-bold" onClick={update.applyUpdate}>
            Update
          </button>
        </div>
      )}
    </main>
  )
}

const SWATCHES = [
  { name: 'bg', cls: 'bg-bg' },
  { name: 'surface', cls: 'bg-surface' },
  { name: 'sunken', cls: 'bg-surface-sunken' },
  { name: 'muted', cls: 'bg-surface-muted' },
  { name: 'brand', cls: 'bg-brand' },
  { name: 'tint', cls: 'bg-brand-tint' },
  { name: 'urgent', cls: 'bg-urgent' },
  { name: 'info', cls: 'bg-info' },
]

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-brand-fill" />
      <path
        d="M8 15l4 4 8-9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function ThemeSegment({ value, onChange }: { value: ThemePreference; onChange: (v: ThemePreference) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-segment bg-surface-sunken p-1">
      {OPTIONS.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            data-testid={`theme-${o.value}`}
            onClick={() => onChange(o.value)}
            className={
              'min-h-[40px] flex-1 rounded-[7px] text-14 font-semibold transition-colors ' +
              (active ? 'bg-surface text-text shadow-sm' : 'text-text-muted')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

type InstallRowProps = {
  state: ReturnType<typeof useInstallPrompt>['state']
  onInstall: () => void
}

function InstallRow({ state, onInstall }: InstallRowProps) {
  switch (state) {
    case 'installed':
      return <p className="text-14 text-text-body">Installed on this device. Push notifications can reach it.</p>
    case 'available':
      return (
        <button
          onClick={onInstall}
          className="flex min-h-[48px] w-full items-center justify-center rounded-input bg-brand-fill px-5 text-15 font-bold text-on-brand hover:bg-brand-fill-hover"
        >
          Add to home screen
        </button>
      )
    case 'ios-manual':
      return (
        <ol className="list-decimal space-y-1 pl-5 text-14 text-text-body">
          <li>Tap the Share button in Safari.</li>
          <li>Choose Add to Home Screen, then Add.</li>
        </ol>
      )
    default:
      return (
        <p className="text-14 text-text-muted">
          Open this page in Safari on iPhone or Chrome on Android to install it.
        </p>
      )
  }
}
