import { DropdownMenu } from 'radix-ui'
import { StatusPill, type PillStatus } from './Pill'
import { IconCheck, IconChevronDown } from './icons'

/**
 * The status control on an Ops ticket (design/screens/Ops-Ticket): a 52px field with an
 * 11px label and the current status, dropping a panel of status pills, the current one
 * checked. `actions` are more items under a line. Without onPick it only shows the state.
 */
const ITEM =
  'flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-15 font-medium text-text outline-none data-[highlighted]:bg-surface-hover'

export function StatusMenu({
  value,
  valueLabel,
  options,
  onPick,
  actions = [],
  busy = false,
}: {
  value: PillStatus
  valueLabel: string
  options: PillStatus[]
  onPick?: (status: PillStatus) => void
  actions?: { label: string; onSelect: () => void }[]
  busy?: boolean
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={!onPick || busy}
        className="flex min-h-[52px] w-full flex-col gap-0.5 rounded-input border border-border-strong bg-surface px-3 py-2 text-left outline-none transition-colors disabled:opacity-60 data-[state=open]:border-brand"
      >
        <span className="text-11 font-bold uppercase tracking-[.04em] text-text-secondary">Status</span>
        <span className="flex items-center justify-between gap-1.5 text-14 font-semibold text-text">
          {valueLabel}
          {onPick && <IconChevronDown size={16} className="flex-none" />}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-30 flex w-[var(--radix-dropdown-menu-trigger-width)] flex-col rounded-card border border-border bg-surface p-1.5 text-text shadow-raised"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(status) => onPick?.(status as PillStatus)}>
            {options.map((status) => (
              <DropdownMenu.RadioItem key={status} value={status} className={ITEM}>
                <span className="flex-1">
                  <StatusPill status={status} />
                </span>
                <DropdownMenu.ItemIndicator>
                  <IconCheck size={18} strokeWidth={2.6} className="text-brand" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {actions.length > 0 && <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />}
          {actions.map((action) => (
            <DropdownMenu.Item key={action.label} className={`${ITEM} font-semibold`} onSelect={action.onSelect}>
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
