import { useId, useState, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { passwordRules } from '../auth/validation'
import { IconCheck, IconChevronDown, IconSearch } from './icons'

/**
 * Form fields: 13px semibold label, 4 to 6px gap, white input with 1px
 * border-strong, 12px radius, 12px 14px padding, 15px text (never below 16px
 * on a phone: the base stylesheet pins fields to 16px). Readonly fields sit
 * on surface-muted with faint text. React 19 passes `ref` as a prop, so the
 * fields take it straight through.
 */

const FIELD =
  'w-full min-h-[48px] rounded-input border border-border-strong bg-surface px-3.5 py-3 text-text placeholder:text-text-muted focus:border-brand focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger'

/* Text fields only: a <select> always matches :read-only, which would gray every dropdown. */
const READONLY = 'read-only:bg-surface-muted read-only:text-text-faint'

type Wrap = {
  label: string
  /** Adds a lighter "(optional)" after the label, as on the boards. */
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export function FieldWrap({ label, optional, hint, error, className = '', children }: Wrap) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-13 font-semibold text-text-body">
        {label}
        {optional && <span className="font-normal text-text-muted"> (optional)</span>}
      </label>
      {children(id, describedBy)}
      {error && (
        <span id={errorId} role="alert" className="text-13 font-semibold text-danger">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="text-13 text-text-secondary">
          {hint}
        </span>
      )}
    </div>
  )
}

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & {
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
}

export function Input({ label, optional, hint, error, className, ref, ...rest }: InputProps) {
  return (
    <FieldWrap label={label} optional={optional} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${FIELD} ${READONLY}`}
          {...rest}
        />
      )}
    </FieldWrap>
  )
}

/** Password input with a Show / Hide button inside its right edge. */
export function PasswordField({ label, hint, error, className, ref, ...rest }: Omit<InputProps, 'type' | 'optional'>) {
  const [shown, setShown] = useState(false)
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <div className="relative flex">
          <input
            ref={ref}
            id={id}
            type={shown ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={`${FIELD} pr-16`}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-0.5 min-h-tap px-3 text-13 font-semibold text-brand transition-colors hover:text-brand-strong active:text-brand-strong active:duration-0"
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        </div>
      )}
    </FieldWrap>
  )
}

/** The checklist under a new password: a check once a rule is met, a ring until then. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {passwordRules(password).map((r) => (
        <li
          key={r.text}
          className={`flex items-center gap-2 text-13 ${r.ok ? 'font-semibold text-brand' : 'text-text-secondary'}`}
        >
          <span className="flex w-3.5 flex-none justify-center">
            {r.ok ? (
              <IconCheck size={14} />
            ) : (
              <span aria-hidden="true" className="h-3 w-3 rounded-full border-[1.5px] border-current" />
            )}
          </span>
          {r.text}
        </li>
      ))}
    </ul>
  )
}

type TextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'id'> & {
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
}

export function Textarea({ label, optional, hint, error, className, rows = 3, ref, ...rest }: TextareaProps) {
  return (
    <FieldWrap label={label} optional={optional} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${FIELD} ${READONLY} resize-none leading-snug`}
          {...rest}
        />
      )}
    </FieldWrap>
  )
}

type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'id'> & {
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
}

/** Native select with the design's caret; native pickers are what phones do best. */
export function Select({ label, optional, hint, error, className, children, ref, ...rest }: SelectProps) {
  return (
    <FieldWrap label={label} optional={optional} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <div className="relative flex">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={`${FIELD} appearance-none pr-[38px] text-ellipsis`}
            {...rest}
          >
            {children}
          </select>
          <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        </div>
      )}
    </FieldWrap>
  )
}

/** Search box: icon on the left, 44px, 1px border (not border-strong), no visible label. */
export function SearchField({
  label,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label
      className={`flex min-h-tap items-center gap-2.5 rounded-input border border-border bg-surface px-3.5 focus-within:border-brand ${className}`}
    >
      <IconSearch className="text-text-muted" />
      <input
        type="search"
        aria-label={label}
        className="flex-1 bg-transparent text-text outline-none placeholder:text-text-muted"
        {...rest}
      />
    </label>
  )
}
