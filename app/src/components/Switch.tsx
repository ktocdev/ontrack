import { Switch as RadixSwitch } from 'radix-ui'
import type { ReactNode } from 'react'
import { IconChevronRight } from './icons'

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
      <RadixSwitch.Thumb className="block h-[22px] w-[22px] rounded-full bg-white shadow-knob transition-transform data-[state=checked]:translate-x-5" />
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

/**
 * A row in a list card with two things to tap (My categories, OT-119): the text opens more
 * settings, and the switch on the right turns the thing on or off at once. A line between
 * them keeps the two targets apart, and the chevron says the text leads somewhere.
 */
export function SwitchListRow({
  title,
  subtitle,
  onOpen,
  ...rest
}: Props & {
  title: ReactNode
  subtitle?: ReactNode
  onOpen: () => void
}) {
  return (
    <div className="flex min-h-[60px] items-stretch border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3.5 pr-2 text-left text-text transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-14 font-semibold text-text">{title}</span>
          {subtitle && <span className="text-12 text-text-muted">{subtitle}</span>}
        </span>
        <IconChevronRight size={16} className="flex-none text-text-muted" />
      </button>
      <span className="flex flex-none items-center border-l border-border px-3.5">
        <Switch {...rest} />
      </span>
    </div>
  )
}
