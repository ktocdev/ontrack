import { DropdownMenu } from 'radix-ui'
import { Link } from 'react-router'
import { IconEllipsis } from './icons'

/**
 * A "more" menu: a 44px framed ellipsis button that drops a list of links or actions, in
 * the restaurant picker's panel (14px radius, 6px padding, 48px rows). No board draws it.
 */
type MenuItem = { label: string } & ({ to: string } | { onSelect: () => void })

const ITEM =
  'flex min-h-12 cursor-pointer items-center rounded-control px-2.5 text-15 font-medium text-text outline-none hover:text-text data-[highlighted]:bg-surface-hover'

export function OverflowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-input border border-border bg-surface text-text transition-colors hover:border-border-strong active:bg-surface-muted active:duration-0 data-[state=open]:border-brand"
      >
        <IconEllipsis size={20} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-30 flex min-w-[220px] flex-col rounded-card border border-border bg-surface p-1.5 text-text shadow-raised"
        >
          {items.map((item) =>
            'to' in item ? (
              <DropdownMenu.Item key={item.label} asChild>
                <Link to={item.to} className={ITEM}>
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item key={item.label} className={ITEM} onSelect={item.onSelect}>
                {item.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
