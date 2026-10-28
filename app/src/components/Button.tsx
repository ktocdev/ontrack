import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { ButtonSpinner } from './Skeleton'

/**
 * Buttons from the design:
 *  primary   52px, brand fill, white 16px bold   (Create account, Save changes)
 *  secondary 48px, white, 1px border-strong      (Cancel, Go to my tickets)
 *  danger    52px, danger fill                   (Delete)
 *  compact   44px primary with 15px text         (Invite, header actions)
 *  small     44px secondary with 14px text       (Search equipment on 404)
 *  ghost     40px text-only brand link           (Report this problem)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'compact' | 'small' | 'ghost'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'min-h-[52px] w-full rounded-input bg-brand-fill px-5 text-16 font-bold text-on-brand hover:bg-brand-fill-hover',
  secondary:
    'min-h-[48px] w-full rounded-input border border-border-strong bg-surface px-4 text-15 font-semibold text-text hover:border-border-muted',
  danger: 'min-h-[52px] w-full rounded-input bg-danger-fill px-5 text-16 font-bold text-white',
  compact: 'min-h-[44px] rounded-input bg-brand-fill px-4 text-15 font-bold text-on-brand hover:bg-brand-fill-hover',
  small:
    'min-h-[44px] rounded-input border border-border-strong bg-surface px-4 text-14 font-semibold text-text hover:border-border-muted',
  ghost: 'min-h-[40px] rounded-control px-1 text-14 font-semibold text-brand hover:text-brand-strong',
}

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress'

export function buttonClasses(variant: ButtonVariant, className = '') {
  return `${BASE} ${VARIANT[variant]} ${className}`
}

type Common = {
  variant?: ButtonVariant
  icon?: ReactNode
  loading?: boolean
  className?: string
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <ButtonSpinner /> : icon}
      {children}
    </button>
  )
}

/** Same look, but navigates. Use for "Go to open tickets" style actions. */
export function ButtonLink({ variant = 'primary', icon, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={buttonClasses(variant, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

/** 44px square icon button (back arrow, close, scan QR). */
export function IconButton({
  label,
  framed = false,
  className = '',
  children,
  ...rest
}: { label: string; framed?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-11 w-11 items-center justify-center text-text ${
        framed ? 'rounded-input border border-border-strong bg-surface' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
