import { ButtonSpinner } from './Skeleton'

/**
 * A new build is waiting (no board): a green bar above the tab bar with Update, on the
 * primary button's fill, which stays dark in dark mode.
 * Once tapped it says so with a spinner, and a light scrim over the page takes taps,
 * since the page reloads under anything started now. `fixed={false}` is for /kit.
 */
export function UpdateBar({
  updating,
  onUpdate,
  fixed = true,
}: {
  updating: boolean
  onUpdate: () => void
  fixed?: boolean
}) {
  const bar = (
    <div
      role="status"
      className={`flex min-h-[68px] items-center justify-between gap-3 rounded-input bg-brand-fill px-4 py-3 text-on-brand shadow-raised ${
        fixed ? 'fixed inset-x-4 z-50 mx-auto max-w-[480px]' : ''
      }`}
      style={fixed ? { bottom: 'calc(84px + max(8px, var(--safe-bottom)))' } : undefined}
    >
      {updating ? (
        <span className="flex items-center gap-2.5 text-14 font-semibold">
          <ButtonSpinner />
          Updating, one moment please…
        </span>
      ) : (
        <>
          <span className="text-14 font-semibold">A new version is ready.</span>
          <button type="button" className="min-h-tap rounded-control px-3 font-bold" onClick={onUpdate}>
            Update
          </button>
        </>
      )}
    </div>
  )
  if (!fixed || !updating) return bar
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-scrim/40 animate-[fade-in_.15s_ease-out]" />
      {bar}
    </>
  )
}
