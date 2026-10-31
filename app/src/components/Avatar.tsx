import { useState } from 'react'
import type { AppRole } from '../lib/supabase'

/**
 * Initials avatar. Tone follows the role as drawn on the canvas: managers on
 * brand-tint with brand text, ops on the info tint, leadership and admin on
 * surface-muted, and someone still invited in the color of their invite: gold
 * while pending, orange once expired. Sizes: 28 (card corner), 30 (thread), 38 (Users), 40
 * (header), 52 (User profile), 88 (profile). With a photo the image fills the circle.
 */

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const TONE: Record<AppRole | 'you' | 'pending' | 'expired', string> = {
  manager: 'bg-brand-tint text-brand',
  ops: 'bg-status-progress-bg text-status-progress-text',
  leadership: 'bg-surface-muted text-text-body',
  admin: 'bg-surface-muted text-text-body',
  you: 'bg-brand-fill text-on-brand',
  pending: 'bg-status-waiting-bg text-status-waiting-text',
  expired: 'bg-status-open-bg text-status-open-text',
}

type Props = {
  name: string
  role?: keyof typeof TONE
  size?: 28 | 30 | 38 | 40 | 52 | 88
  label?: string
  /** A profile photo URL; initials show instead if it fails to load. */
  src?: string
  className?: string
}

export function Avatar({ name, role = 'manager', size = 40, label, src, className = '' }: Props) {
  const [failed, setFailed] = useState<string | undefined>()
  const showPhoto = src && failed !== src
  const font =
    size === 88
      ? 'text-28'
      : size === 52
        ? 'text-17'
        : size === 28 || size === 30
          ? 'text-11 tracking-[.02em]'
          : 'text-13'
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
