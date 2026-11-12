import { useId } from 'react'

/**
 * The Cost card on Log service and Edit service record: a row per amount, the label on
 * the left and a 120px right-aligned field, then the total under a divider. White card,
 * 1px border, 12px radius, 12px 14px padding, 10px between rows; the total is 16px bold.
 * The fields are text with a decimal keypad, so "$120.00" and "120" both read, and they
 * show "$120.00" as the board writes it, at 16px like every field on a phone. An amount
 * that won't read is marked and the total shows a dash until it is fixed.
 */
export type CostRow = {
  label: string
  value: string
  onChange: (value: string) => void
  /** Tidies the amount on leaving the field ("120" to "$120.00"). */
  onBlur?: () => void
  invalid?: boolean
}

export function CostCard({
  rows,
  total,
  disabled,
  className = '',
}: {
  rows: CostRow[]
  /** The live total, already formatted, or null while an amount won't read. */
  total: string | null
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div
      className={`flex flex-none flex-col gap-2.5 rounded-input border border-border bg-surface px-3.5 py-3 ${className}`}
    >
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-2.5">
          <label htmlFor={`${id}-${i}`} className="flex-1 text-14 text-text-body">
            {r.label}
          </label>
          <input
            id={`${id}-${i}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="$0.00"
            disabled={disabled}
            value={r.value}
            aria-invalid={r.invalid || undefined}
            onChange={(e) => r.onChange(e.target.value)}
            onBlur={r.onBlur}
            className="min-h-tap w-[120px] flex-none rounded-control border border-border-strong bg-surface px-3 py-2.5 text-right text-text placeholder:text-text-faint focus:border-brand focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger"
          />
        </div>
      ))}
      <div className="flex justify-between border-t border-surface-muted pt-2.5 text-16 font-bold">
        <span>Total</span>
        <span aria-live="polite">{total ?? '–'}</span>
      </div>
    </div>
  )
}
