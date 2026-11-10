import { useEffect, useId, useState, type ReactNode } from 'react'
import { parseColor, toHex } from '../tokens/color'

/** Small controls for the token panel, in the docs palette. */

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
  defaultValue,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  defaultValue?: number
}) {
  const id = useId()
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > step / 2
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-13 font-semibold text-ds-ink-soft">
          {label}
        </label>
        <span className="flex items-center gap-2">
          {changed && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="text-12 font-semibold text-ds-accent hover:underline"
            >
              Reset
            </button>
          )}
          <output htmlFor={id} className="font-ds-mono text-12 text-ds-muted tabular-nums">
            {format(value)}
          </output>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ds-range w-full"
      />
    </div>
  )
}

/** A native color well beside a hex field; the field commits once it holds a valid color. */
export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  label: string
}) {
  const parsed = parseColor(value)
  const hex = parsed ? toHex(parsed) : '#000000'
  const [text, setText] = useState(hex)
  useEffect(() => setText(hex), [hex])
  const valid = parseColor(text) !== null
  return (
    <span className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label}, color picker`}
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="ds-well h-9 w-9 flex-none rounded-[8px]"
      />
      <input
        type="text"
        aria-label={`${label}, hex`}
        aria-invalid={!valid}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const c = parseColor(e.target.value.trim())
          if (c) onChange(toHex(c))
        }}
        onBlur={() => setText(hex)}
        className={`h-9 w-[104px] rounded-[8px] border bg-ds-panel px-2 font-ds-mono text-[16px] text-ds-ink sm:text-13 ${valid ? 'border-ds-line-strong' : 'border-ds-warn'}`}
      />
    </span>
  )
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 w-full items-center gap-1.5 text-left text-13 font-semibold text-ds-muted hover:text-ds-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {summary}
      </button>
      {open && (
        <div id={id} className="pt-1">
          {children}
        </div>
      )}
    </div>
  )
}

export function PanelSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-ds-line px-5 py-5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-ds-display text-15 font-bold text-ds-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TextButton({
  children,
  onClick,
  tone = 'accent',
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'accent' | 'warn'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-12 font-semibold hover:underline ${tone === 'warn' ? 'text-ds-warn' : 'text-ds-accent'}`}
    >
      {children}
    </button>
  )
}

export function PanelButton({
  children,
  onClick,
  primary = false,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center rounded-[10px] px-3.5 text-13 font-semibold transition-colors ${primary ? 'bg-ds-accent text-ds-on-accent hover:opacity-90' : 'border border-ds-line-strong text-ds-ink hover:bg-ds-sunken'}`}
    >
      {children}
    </button>
  )
}
