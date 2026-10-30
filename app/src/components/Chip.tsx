import type { ButtonHTMLAttributes } from 'react'

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
