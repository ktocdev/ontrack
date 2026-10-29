import { useState } from 'react'
import type { AppRole } from '../lib/supabase'

/**
 * Initials avatar. Tone follows the role as drawn on the canvas: managers on
 * brand-tint with brand text, ops on the info tint, leadership and admin on
 * surface-muted. Sizes: 28 (card corner), 40 (header), 88 (profile). With a
 * photo the image fills the circle.
 */

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const TONE: Record<AppRole | 'you', string> = {
  manager: 'bg-brand-tint text-brand',
  ops: 'bg-status-progress-bg text-status-progress-text',
  leadership: 'bg-surface-muted text-text-body',
  admin: 'bg-surface-muted text-text-body',
  you: 'bg-brand-fill text-on-brand',
}

type Props = {
  name: string
  role?: AppRole | 'you'
  size?: 28 | 40 | 88
  label?: string
  /** A profile photo URL; initials show instead if it fails to load. */
  src?: string
  className?: string
}

export function Avatar({ name, role = 'manager', size = 40, label, src, className = '' }: Props) {
  const [failed, setFailed] = useState<string | undefined>()
  const showPhoto = src && failed !== src
  const font = size === 88 ? 'text-[28px]' : size === 28 ? 'text-11 tracking-[.02em]' : 'text-13'
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-flex flex-none items-center justify-center overflow-hidden rounded-full font-display font-bold ${TONE[role]} ${font} ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-full object-cover"
          draggable={false}
          onError={() => setFailed(src)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
