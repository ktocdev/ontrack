import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

/**
 * Cards and rows. A card is white on the screen background with a 1px border
 * and 14px radius; tappable cards lift the border to border-muted on hover.
 * A list card holds rows separated by 1px lines.
 */

// flex-none: inside a scrolling flex column an overflow-hidden card would otherwise shrink and clip its rows.
const CARD = 'flex-none rounded-card border border-border bg-surface text-text'

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${CARD} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardLink({ className = '', children, ...rest }: LinkProps) {
  return (
    <Link
      className={`${CARD} block transition-colors hover:border-border-muted active:bg-surface-hover active:duration-0 ${className}`}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** A card whose children are rows; it clips them to the radius. */
export function ListCard({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${CARD} overflow-hidden ${className}`} {...rest}>
      {children}
    </div>
  )
}

type RowProps = {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
}

/** Settings-style row: 60px min height, 10px 14px padding, divider on top. */
export function ListRow({ title, subtitle, leading, trailing, className = '' }: RowProps) {
  return (
    <div
      className={`flex min-h-[60px] items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0 ${className}`}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold text-text">{title}</span>
        {subtitle && <span className="text-12 text-text-muted">{subtitle}</span>}
      </div>
      {trailing}
    </div>
  )
}

/** Row that navigates. Same geometry as ListRow with a hover and pressed tint. */
export function ListRowLink({ title, subtitle, leading, trailing, className = '', ...rest }: RowProps & LinkProps) {
  return (
    <Link
      className={`flex min-h-[60px] items-center gap-3 border-t border-border px-3.5 py-2.5 text-text first:border-t-0 transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0 ${className}`}
      {...rest}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold text-text">{title}</span>
        {subtitle && <span className="text-12 text-text-muted">{subtitle}</span>}
      </div>
      {trailing}
    </Link>
  )
}

/** Row that opens something on the same screen (a sheet). Same geometry as ListRowLink. */
export function ListRowButton({
  title,
  subtitle,
  leading,
  trailing,
  className = '',
  ...rest
}: RowProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'>) {
  return (
    <button
      type="button"
      className={`flex min-h-[60px] w-full items-center gap-3 border-t border-border px-3.5 py-2.5 text-left text-text first:border-t-0 transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0 ${className}`}
      {...rest}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold text-text">{title}</span>
        {subtitle && <span className="text-12 text-text-muted">{subtitle}</span>}
      </div>
      {trailing}
    </button>
  )
}

/** 36px tinted square that leads a settings row (Help center, Report a problem). */
export function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-control bg-brand-tint-soft text-brand">
      {children}
    </span>
  )
}

/** Key / value row inside a detail card (Equipment details). */
export function KeyValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[45px] items-center justify-between gap-4 border-b border-surface-muted last:border-b-0">
      <span className="text-14 text-text-muted">{label}</span>
      <span className="text-right text-14 font-medium text-text">{children}</span>
    </div>
  )
}
