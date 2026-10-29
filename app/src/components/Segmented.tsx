/**
 * Segmented control: track on surface-sunken with 3px padding and 11px
 * radius; segments are 36 to 40px, 9px radius, 13 or 14px semibold; the
 * selected one is white with a 1px shadow.
 */
export type Segment<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Segment<T>[]
  label: string
  /** 'sm' is the 36px dense form used above lists; 'md' is 40px. */
  size?: 'sm' | 'md'
  /** Let segments size to their text instead of sharing the width. */
  fit?: boolean
  className?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  fit = false,
  className = '',
}: Props<T>) {
  const h = size === 'sm' ? 'min-h-9 text-13' : 'min-h-10 text-14'
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-1 rounded-[11px] bg-surface-sunken p-[3px] ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`${fit ? 'px-3.5' : 'flex-1 px-1'} ${h} whitespace-nowrap rounded-segment font-semibold transition-colors ${
              on
                ? 'bg-surface text-text shadow-[0_1px_2px_rgba(21,32,27,.12)]'
                : 'text-text-secondary hover:text-text active:bg-surface/60 active:text-text active:duration-0'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
