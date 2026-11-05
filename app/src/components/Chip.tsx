import type { ButtonHTMLAttributes } from 'react'
import { IconClose, IconFilter } from './icons'

/**
 * Round chips from the design. `filter` is the 36px list filter that goes dark
 * when on (Users: All · 42); `pick` is the 40px multi-select that goes brand when
 * on (Invite user: restaurants). Both reach the 44px tap target through a
 * transparent layer above and below, so they keep the drawn height.
 */
const TONE = {
  filter: {
    base: 'min-h-9 px-3 text-13',
    on: 'border-text bg-text text-bg',
  },
  pick: {
    base: 'min-h-10 px-3.5 text-13',
    on: 'border-brand-fill bg-brand-fill text-on-brand',
  },
}

type Props = { selected: boolean; tone?: keyof typeof TONE } & ButtonHTMLAttributes<HTMLButtonElement>

export function Chip({ selected, tone = 'filter', className = '', children, ...rest }: Props) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`relative whitespace-nowrap rounded-pill border font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-1 active:duration-0 ${t.base} ${
        selected
          ? t.on
          : 'border-border-strong bg-surface text-text-body hover:border-border-muted active:bg-surface-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * One choice from a few, as equal chips under a label (Urgency): 40px, 10px radius,
 * 13px semibold; the chosen one is brand on its tint.
 */
export function ChoiceChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-none flex-col gap-1.5">
      <span className="text-13 font-semibold text-text-body">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`relative min-h-10 flex-1 rounded-control border text-13 font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-0.5 active:duration-0 ${
                on
                  ? 'border-brand bg-brand-tint-soft text-brand-strong'
                  : 'border-border-strong bg-surface text-text-body hover:border-border-muted active:bg-surface-muted'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Filter button beside a search field (Ops equipment): 44px, 12px radius, and
 * "Filter · 2" on the brand tint while filters are on.
 */
export function FilterButton({ count, ...rest }: { count: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={`flex min-h-tap flex-none items-center gap-1.5 rounded-input border px-3.5 text-14 font-semibold transition-colors active:duration-0 ${
        count
          ? 'border-brand bg-brand-tint-soft text-brand-strong'
          : 'border-border-strong bg-surface text-text hover:border-border-muted active:bg-surface-muted'
      }`}
      {...rest}
    >
      <IconFilter size={16} />
      {count ? `Filter · ${count}` : 'Filter'}
    </button>
  )
}

/** A filter that is on, under the search: 32px on the brand tint; tapping it takes the filter off. */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={onRemove}
      className="relative inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-brand-tint-soft px-2.5 text-13 font-semibold text-brand-strong before:absolute before:inset-x-0 before:-inset-y-1.5 active:bg-brand-tint active:duration-0"
    >
      {label}
      <IconClose size={12} strokeWidth={2.6} />
    </button>
  )
}
