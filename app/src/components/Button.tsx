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
 *  secondary-danger  secondary with danger text  (Sign out)
 *  ghost-danger      ghost with danger text      (Remove photo)
 *  medium    48px primary with 15px text         (Invite people, empty and error screens)
 *  outline   medium's size, brand outline         (Review & submit before the walkthrough is done)
 *  done      medium once its work is done        (Request sent)
 *  tall      52px secondary with 16px bold text  (Reopen ticket)
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'compact'
  | 'small'
  | 'ghost'
  | 'secondary-danger'
  | 'ghost-danger'
  | 'medium'
  | 'outline'
  | 'done'
  | 'tall'

/*
 * Hover and pressed colors are prefixed not-disabled so a disabled or loading
 * button stays still. Tailwind only applies hover: on devices that can hover,
 * so a phone never keeps a stuck hover color after a tap; it gets active:.
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'min-h-[52px] rounded-input bg-brand-fill px-5 text-16 font-bold text-on-brand not-disabled:hover:bg-brand-fill-hover not-disabled:active:bg-brand-fill-active',
  secondary:
    'min-h-[48px] rounded-input border border-border-strong bg-surface px-4 text-15 font-semibold text-text not-disabled:hover:border-border-muted not-disabled:active:border-border-muted not-disabled:active:bg-surface-muted',
  danger:
    'min-h-[52px] rounded-input bg-danger-fill px-5 text-16 font-bold text-white not-disabled:hover:bg-danger-fill-hover not-disabled:active:bg-danger-fill-active',
  compact:
    'min-h-[44px] rounded-input bg-brand-fill px-4 text-15 font-bold text-on-brand not-disabled:hover:bg-brand-fill-hover not-disabled:active:bg-brand-fill-active',
  medium:
    'min-h-[48px] rounded-input bg-brand-fill px-5 text-15 font-bold text-on-brand not-disabled:hover:bg-brand-fill-hover not-disabled:active:bg-brand-fill-active',
  outline:
    'min-h-[48px] rounded-input border-[1.5px] border-brand bg-surface px-5 text-15 font-bold text-brand not-disabled:hover:bg-brand-tint-soft not-disabled:active:bg-brand-tint not-disabled:active:text-brand-strong',
  done: 'min-h-[48px] rounded-input bg-brand-tint px-5 text-15 font-bold text-brand-strong disabled:cursor-default disabled:opacity-100',
  tall: 'min-h-[52px] rounded-input border border-border-strong bg-surface px-4 text-16 font-bold text-text not-disabled:hover:border-border-muted not-disabled:active:bg-surface-muted',
  small:
    'min-h-[44px] rounded-input border border-border-strong bg-surface px-4 text-14 font-semibold text-text not-disabled:hover:border-border-muted not-disabled:active:border-border-muted not-disabled:active:bg-surface-muted',
  'secondary-danger':
    'min-h-[48px] rounded-input border border-border-strong bg-surface px-4 text-15 font-semibold text-danger not-disabled:hover:border-border-muted not-disabled:active:border-border-muted not-disabled:active:bg-surface-muted',
  'ghost-danger':
    'min-h-[40px] rounded-control px-1 text-14 font-semibold text-danger not-disabled:active:bg-surface-muted',
  ghost:
    'min-h-[40px] rounded-control px-1 text-14 font-semibold text-brand not-disabled:hover:text-brand-strong not-disabled:active:bg-brand-tint-soft not-disabled:active:text-brand-strong',
}

/* active:duration-0 makes the press land at once; release fades back over 150ms. */
const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors active:duration-0 disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress'

/** Primary, secondary and danger fill the width unless the caller sets its own (w-auto). */
const FULL_WIDTH: ButtonVariant[] = ['primary', 'secondary', 'tall', 'danger', 'secondary-danger']

export function buttonClasses(variant: ButtonVariant, className = '') {
  const width = FULL_WIDTH.includes(variant) && !/(^|\s)w-/.test(className) ? 'w-full' : ''
  return `${BASE} ${VARIANT[variant]} ${width} ${className}`
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
      className={`inline-flex h-11 w-11 items-center justify-center text-text transition-colors active:duration-0 disabled:opacity-60 ${
        framed
          ? 'rounded-input border border-border-strong bg-surface not-disabled:hover:border-border-muted not-disabled:active:bg-surface-muted'
          : 'rounded-control not-disabled:hover:bg-surface-hover not-disabled:active:bg-surface-sunken'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
