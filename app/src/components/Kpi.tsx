import { Link } from 'react-router'
import { IconChevronRight } from './icons'

const VALUE = { large: 'text-24', normal: 'text-22', small: 'text-17 leading-[26px]' }
const TONE = { default: '', urgent: 'text-status-open-text', muted: 'text-text-muted' }

/**
 * A figure and what it counts, in a two-up grid: a contractor's spend and visits (OT-95),
 * leadership's Overview (OT-143). White, a 1px border and the input radius, the figure in
 * Archivo. `wide` spans both columns; `tone` colors the figure, urgent for a count that
 * needs attention and muted where there is nothing yet. With `to` the card opens what it
 * counts (the Overview's Open tickets and Urgent, from feedback Nov 24, 2026), with a
 * chevron by the label.
 */
export function Kpi({
  value,
  label,
  wide,
  size = 'normal',
  tone = 'default',
  to,
}: {
  value: string
  label: string
  wide?: boolean
  size?: keyof typeof VALUE
  tone?: keyof typeof TONE
  to?: string
}) {
  const cls = `flex min-w-0 flex-col gap-0.5 rounded-input border border-border bg-surface px-3.5 py-3 ${wide ? 'col-span-2' : ''}`
  const figure = (
    <b className={`font-display font-bold [overflow-wrap:anywhere] ${VALUE[size]} ${TONE[tone]}`}>{value}</b>
  )
  if (!to)
    return (
      <div className={cls}>
        {figure}
        <span className="text-12 font-semibold text-text-secondary">{label}</span>
      </div>
    )
  return (
    <Link
      to={to}
      className={`${cls} transition-colors hover:border-border-strong hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {figure}
      <span className="flex items-center justify-between gap-1 text-12 font-semibold text-text-secondary">
        {label}
        <IconChevronRight size={14} aria-hidden="true" className="flex-none" />
      </span>
    </Link>
  )
}
