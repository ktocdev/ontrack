/**
 * The one big field of the 2-step screens: a 64px box with a 1.5px brand border and
 * centered mono text. `totp` takes six digits and `backup` takes XXXX-XXXX.
 */
export function CodeInput({
  id,
  label,
  mode = 'totp',
  size = 30,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  mode?: 'totp' | 'backup'
  /** Setup draws 30px, the sign-in code 26px. */
  size?: 26 | 30
  value: string
  onChange: (value: string) => void
  error?: string | null
}) {
  const clean = (raw: string) =>
    mode === 'totp'
      ? raw.replace(/\D/g, '').slice(0, 6)
      : raw
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, '')
          .slice(0, 9)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-13 font-semibold text-text-body">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={mode === 'totp' ? 'numeric' : 'text'}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={mode === 'totp' ? '······' : 'XXXX-XXXX'}
        value={value}
        onChange={(e) => onChange(clean(e.target.value))}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`box-border min-h-16 w-full rounded-card border-[1.5px] bg-surface px-4 text-center font-mono font-medium text-text outline-none placeholder:text-text-muted ${
          error ? 'border-danger' : 'border-brand'
        } ${size === 30 ? 'text-30' : 'text-26'} ${mode === 'totp' ? 'tracking-[.45em]' : 'tracking-[.12em]'}`}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="text-13 font-semibold text-danger">
          {error}
        </span>
      )}
    </div>
  )
}

/** "Step 2 of 4" as bars: four 4px segments, filled up to the current one. */
export function StepBars({ step, total = 4, className = '' }: { step: number; total?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex gap-1.5 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-square ${i < step ? 'bg-brand' : 'bg-border'}`} />
      ))}
    </div>
  )
}
