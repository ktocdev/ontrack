import type { CSSProperties } from 'react'

/**
 * A restaurant is always shown as its color square followed by its name in
 * body text; the name itself is never colored. The square is 9 to 14px with
 * an inset outline so light accents still read on white.
 */

export function RestaurantSquare({
  color,
  size = 10,
  className = '',
}: {
  color: string
  size?: number
  className?: string
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    background: color,
    borderRadius: size >= 12 ? 3 : 2,
    boxShadow: 'inset 0 0 0 1px var(--square-outline)',
  }
  return <span aria-hidden="true" className={`inline-block flex-none ${className}`} style={style} />
}

type Props = {
  name: string
  color: string
  size?: number
  /** 'label' is the 14px semibold header form; 'meta' the 12px bold form on cards. */
  variant?: 'label' | 'meta' | 'plain'
  className?: string
}

export function RestaurantName({ name, color, size, variant = 'label', className = '' }: Props) {
  const text =
    variant === 'label'
      ? 'text-14 font-semibold text-text'
      : variant === 'meta'
        ? 'text-12 font-bold text-text-body'
        : 'text-text-body'
  const sq = size ?? (variant === 'meta' ? 9 : 10)
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${text} ${className}`}>
      <RestaurantSquare color={color} size={sq} />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** "All restaurants": a 2×2 grid of the four accents, 11px square. */
export function AllRestaurantsSquare({ colors, className = '' }: { colors: string[]; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none gap-px ${className}`}
      style={{ gridTemplateColumns: 'repeat(2, 5px)', width: 11, height: 11 }}
    >
      {colors.slice(0, 4).map((c, i) => (
        <span key={i} style={{ background: c, borderRadius: 1.5 }} />
      ))}
    </span>
  )
}
