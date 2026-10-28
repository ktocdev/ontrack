import { Switch as RadixSwitch } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * 48×28 switch: track on border-strong, brand when on; 22px white knob with a
 * soft shadow. Pair it with a label on the left in a 44px row.
 */
type Props = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, label, disabled, className = '' }: Props) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={`flex h-7 w-12 flex-none items-center rounded-pill bg-border-strong p-[3px] transition-colors data-[state=checked]:bg-brand disabled:opacity-60 ${className}`}
    >
      <RadixSwitch.Thumb className="block h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_2px_rgba(21,32,27,.25)] transition-transform data-[state=checked]:translate-x-5" />
    </RadixSwitch.Root>
  )
}

/** A labelled switch row, as on Profile and the filter sheet. */
export function SwitchRow({ title, subtitle, ...rest }: Props & { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex min-h-tap items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-14 font-semibold text-text">{title}</span>
        {subtitle && <span className="text-12 text-text-muted">{subtitle}</span>}
      </div>
      <Switch {...rest} />
    </div>
  )
}
