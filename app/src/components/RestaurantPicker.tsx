import { DropdownMenu } from 'radix-ui'
import { AllRestaurantsSquare, RestaurantName, RestaurantSquare } from './RestaurantName'
import { IconCheck, IconChevronDown } from './icons'

/**
 * The restaurant picker on Ops screens (Ops-Dashboard): the current choice with a
 * chevron, dropping a 290px panel of All restaurants and each one, the current one
 * checked. Someone with one restaurant has nothing to pick, so it is only the name.
 */
type Restaurant = { id: string; name: string; color: string }

const ALL = 'all'
const OPTION =
  'flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-15 font-medium text-text outline-none data-[highlighted]:bg-surface-hover'

export function RestaurantPicker({
  restaurants,
  selectedId,
  onSelect,
}: {
  restaurants: Restaurant[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const colors = restaurants.map((r) => r.color)
  const selected = restaurants.find((r) => r.id === selectedId)
  const only = restaurants.length === 1 ? restaurants[0] : undefined
  if (only) return <RestaurantName name={only.name} color={only.color} />

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="flex min-h-tap min-w-0 items-center gap-1.5 text-14 font-semibold text-text outline-none">
        {selected ? <RestaurantSquare color={selected.color} /> : <AllRestaurantsSquare colors={colors} />}
        <span className="truncate">{selected ? selected.name : `All restaurants (${restaurants.length})`}</span>
        <IconChevronDown size={16} className="flex-none" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-30 flex w-[290px] max-w-[calc(100vw-32px)] flex-col rounded-card border border-border bg-surface p-1.5 text-text shadow-raised"
        >
          <DropdownMenu.Label className="eyebrow px-2.5 pb-1.5 pt-2">Show tickets for</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={selectedId ?? ALL}
            onValueChange={(value) => onSelect(value === ALL ? null : value)}
          >
            <DropdownMenu.RadioItem value={ALL} className={OPTION}>
              <AllRestaurantsSquare colors={colors} className="mx-px" />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="font-semibold">All restaurants</span>
                <span className="text-12 font-normal text-text-muted">{restaurants.length} restaurants</span>
              </span>
              <DropdownMenu.ItemIndicator>
                <IconCheck size={18} strokeWidth={2.6} className="text-brand" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
            {restaurants.map((r) => (
              <DropdownMenu.RadioItem key={r.id} value={r.id} className={OPTION}>
                <RestaurantSquare color={r.color} size={12} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <DropdownMenu.ItemIndicator>
                  <IconCheck size={18} strokeWidth={2.6} className="text-brand" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
