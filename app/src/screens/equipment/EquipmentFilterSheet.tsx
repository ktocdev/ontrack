import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { NO_FILTERS, type Area, type Filters } from './equipment'

/**
 * Filter equipment (from the Ops-Equipment-List board's sheet). Area and type only:
 * the restaurant picker at the top already scopes every Ops screen, so the board's
 * Restaurant row is left off. Each tap applies at once and the button only closes,
 * saying how many units are left.
 */
export function EquipmentFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  types,
  shown,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: Filters
  onChange: (filters: Filters) => void
  /** Every type at these restaurants, in list order. */
  types: string[]
  /** How many units the filters and search leave. */
  shown: number
}) {
  const toggle = (t: string) =>
    onChange({
      ...filters,
      types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t],
    })
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter equipment"
      action={
        <Button variant="ghost" onClick={() => onChange(NO_FILTERS)}>
          Clear all
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1.5">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Area</span>
          <Segmented<'all' | Area>
            label="Area"
            value={filters.area ?? 'all'}
            onChange={(v) => onChange({ ...filters, area: v === 'all' ? null : v })}
            options={[
              { value: 'all', label: 'All' },
              { value: 'foh', label: 'Front of House' },
              { value: 'boh', label: 'Back of House' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Type</span>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <Chip key={t} tone="pick" selected={filters.types.includes(t)} onClick={() => toggle(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <Button className="mt-2" onClick={() => onOpenChange(false)}>
        Show {shown} {shown === 1 ? 'item' : 'items'}
      </Button>
    </Sheet>
  )
}
