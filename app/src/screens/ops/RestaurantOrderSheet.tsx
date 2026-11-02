import { Button } from '../../components/Button'
import { ReorderList } from '../../components/ReorderList'
import { Sheet } from '../../components/Sheet'

/**
 * The dashboard's Reorder restaurants, from its menu, with no board. It sits apart from
 * the dashboard because dragging a group there would fight with scrolling on a phone.
 * Each move saves as it is made. Loaded on demand, with its drag-and-drop library.
 */
export default function RestaurantOrderSheet({
  open,
  onOpenChange,
  restaurants,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurants: { id: string; name: string; color: string }[]
  onChange: (ids: string[]) => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reorder restaurants"
      description="Drag a handle to put them in the order you want on your dashboard. This is saved on this device."
    >
      <ReorderList label="Restaurants in order" items={restaurants} onChange={onChange} />
      <Button onClick={() => onOpenChange(false)}>Done</Button>
    </Sheet>
  )
}
