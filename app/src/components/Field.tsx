import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { IconChevronDown, IconSearch } from './icons'

/**
 * Form fields: 13px semibold label, 4 to 6px gap, white input with 1px
 * border-strong, 12px radius, 12px 14px padding, 15px text (never below 16px
 * on a phone: the base stylesheet pins fields to 16px). Readonly fields sit
 * on surface-muted with faint text.
 */

const FIELD =
  'w-full min-h-[48px] rounded-input border border-border-strong bg-surface px-3.5 py-3 text-text placeholder:text-text-muted focus:border-brand focus:outline-none disabled:opacity-60 read-only:bg-surface-muted read-only:text-text-faint aria-[invalid=true]:border-danger'

type Wrap = {
  label: string
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export function FieldWrap({ label, hint, error, className = '', children }: Wrap) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-13 font-semibold text-text-body">
        {label}
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

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: ReactNode
  error?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={FIELD}
          {...rest}
        />
      )}
    </FieldWrap>
  )
})

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string
  hint?: ReactNode
  error?: ReactNode
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, rows = 3, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${FIELD} resize-none leading-snug`}
          {...rest}
        />
      )}
    </FieldWrap>
  )
})

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string
  hint?: ReactNode
  error?: ReactNode
}

/** Native select with the design's caret; native pickers are what phones do best. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, children, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
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
})

/** Search box: icon on the left, 44px, 1px border (not border-strong), no visible label. */
export function SearchField({
  label,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label
      className={`flex min-h-tap items-center gap-2.5 rounded-input border border-border bg-surface px-3.5 ${className}`}
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
