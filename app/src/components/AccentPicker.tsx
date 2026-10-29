import { useId } from 'react'
import { IconCheck, IconPlus, IconStatusWaiting } from './icons'

/**
 * Accent color picker (Add restaurant): a row of 44px swatches, each a 36px
 * rounded color with a check when chosen and a 2px text-color ring around it;
 * the last swatch is the hue wheel for a custom color, which opens a panel with
 * the native color picker and a hex field. A warning under the panel explains
 * why a custom color will not save.
 */
export type AccentOption = { value: string; label: string }

type Props = {
  label: string
  hint?: string
  options: AccentOption[]
  /** The chosen preset's value, or 'custom'. */
  value: string
  onChange: (value: string) => void
  /** What is in the hex field (may be half-typed). */
  custom: string
  onCustomChange: (text: string) => void
  warning?: string
}

const SWATCH =
  'flex h-11 w-11 items-center justify-center rounded-input border-2 p-1 transition-colors active:duration-0'
const INNER = 'flex h-full w-full items-center justify-center rounded-[calc(var(--radius-input)-4px)]'

export function AccentPicker({ label, hint, options, value, onChange, custom, onCustomChange, warning }: Props) {
  const id = useId()
  const isCustom = value === 'custom'
  const pickerValue = /^#[0-9a-f]{6}$/i.test(custom) ? custom : '#000000'
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-l`} className="text-13 font-semibold text-text-body">
        {label}
      </span>
      {hint && <span className="text-12 leading-[1.4] text-text-muted">{hint}</span>}
      <div role="radiogroup" aria-labelledby={`${id}-l`} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              onClick={() => onChange(o.value)}
              className={`${SWATCH} ${on ? 'border-text' : 'border-transparent hover:border-border-strong'}`}
            >
              <span className={`${INNER} text-white`} style={{ background: o.value }}>
                {on && <IconCheck size={18} />}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          aria-label="Custom color"
          onClick={() => onChange('custom')}
          className={`${SWATCH} ${isCustom ? 'border-text' : 'border-transparent hover:border-border-strong'}`}
        >
          <span className={INNER} style={{ background: 'var(--swatch-custom)' }}>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface text-text">
              <IconPlus size={12} strokeWidth={3} />
            </span>
          </span>
        </button>
      </div>

      {isCustom && (
        <>
          <div className="flex items-center gap-2.5 rounded-input border border-border bg-surface px-2.5 py-2">
            <input
              type="color"
              value={pickerValue}
              onChange={(e) => onCustomChange(e.target.value)}
              aria-label="Choose a custom color"
              className="h-11 w-11 flex-none cursor-pointer border-0 bg-transparent p-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <label htmlFor={`${id}-hex`} className="text-12 font-semibold text-text-body">
                Hex code
              </label>
              <input
                id={`${id}-hex`}
                type="text"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={7}
                value={custom}
                onChange={(e) => onCustomChange(e.target.value)}
                className="min-w-0 border-0 bg-transparent p-0 font-mono font-medium text-text outline-none"
              />
            </div>
          </div>
          {warning && (
            <span role="status" className="flex items-start gap-1.5 text-12 leading-[1.4] text-status-waiting-text">
              <IconStatusWaiting className="mt-px flex-none" />
              {warning}
            </span>
          )}
        </>
      )}
    </div>
  )
}
