import { AREA_SEGMENTS_SHORT, type Area } from '../../app/areas'
import { Button } from '../../components/Button'
import { RadioCard } from '../../components/RadioCard'
import { ReorderList } from '../../components/ReorderList'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { RESTAURANT_SORTS, type RestaurantSort } from './dashboard'

/**
 * Sort restaurants, from the dashboard's menu (from feedback, Nov 24, 2026; drawn in
 * handoff/feedback-nov-24/sort-sheet.png): Most urgent, Ticket count, or Custom order,
 * which shows the person's own order to drag (it replaced Reorder restaurants). Dragging
 * sits here rather than on the dashboard because it would fight with scrolling on a phone.
 * Each choice and each move saves as it is made, on this device. Loaded on demand, with
 * its drag-and-drop library.
 *
 * Under it, Show first (OT-174): which area's tickets come first inside each restaurant,
 * after the urgent ones. That one is saved to the person's account, so the sheet says so.
 */
export default function RestaurantSortSheet({
  open,
  onOpenChange,
  sort,
  onSort,
  restaurants,
  onReorder,
  firstArea,
  onFirstArea,
  firstAreaFailed = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sort: RestaurantSort
  onSort: (sort: RestaurantSort) => void
  /** The person's own order, for Custom order. With one restaurant only Show first shows. */
  restaurants: { id: string; name: string; color: string }[]
  onReorder: (ids: string[]) => void
  firstArea: Area
  onFirstArea: (area: Area) => void
  /** Saving Show first failed. */
  firstAreaFailed?: boolean
}) {
  const sortsRestaurants = restaurants.length > 1
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={sortsRestaurants ? 'Sort restaurants' : 'Show first'}>
      {sortsRestaurants && (
        <>
          <div role="radiogroup" aria-label="Sort restaurants by" className="flex flex-col gap-2">
            {RESTAURANT_SORTS.map((s) => (
              <RadioCard
                key={s.value}
                checked={sort === s.value}
                title={s.title}
                subtitle={s.subtitle}
                onSelect={() => onSort(s.value)}
              />
            ))}
          </div>
          {sort === 'custom' && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow block">Your order</span>
              <ReorderList label="Your order" items={restaurants} onChange={onReorder} />
            </div>
          )}
          <p className="text-13 text-text-secondary">Saved on this device.</p>
        </>
      )}
      <div className="flex flex-col gap-2">
        <span className="eyebrow block">{sortsRestaurants ? 'Show first in each restaurant' : 'Tickets'}</span>
        <Segmented label="Show first" value={firstArea} onChange={onFirstArea} options={AREA_SEGMENTS_SHORT} />
        <p className={`text-13 ${firstAreaFailed ? 'text-danger' : 'text-text-secondary'}`}>
          {firstAreaFailed
            ? 'We couldn’t save that. Check your connection and pick it again.'
            : 'After urgent tickets. Saved to your account, on every device.'}
        </p>
      </div>
      <Button onClick={() => onOpenChange(false)}>Done</Button>
    </Sheet>
  )
}
