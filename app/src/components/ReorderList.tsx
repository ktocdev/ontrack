import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RestaurantSquare } from './RestaurantName'
import { IconGrip } from './icons'

/**
 * A short list put in order by dragging (no board draws it): each row has a color
 * square, a name and a 44px handle. Only the handle drags, so a finger on the rest of
 * the row still scrolls. On a keyboard, Space picks a handle up, the arrows move it and
 * Space drops it.
 */
type Item = { id: string; name: string; color: string }

function Row({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex min-h-14 items-center gap-2.5 border-t border-border bg-surface py-1.5 pl-4 pr-1.5 text-15 font-semibold first:border-t-0 ${
        isDragging ? 'z-10 rounded-input shadow-raised' : ''
      }`}
    >
      <RestaurantSquare color={item.color} size={12} />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Move ${item.name}`}
        className="flex h-11 w-11 flex-none cursor-grab touch-none items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-hover active:cursor-grabbing active:bg-surface-sunken active:duration-0"
        {...attributes}
        {...listeners}
      >
        <IconGrip size={20} />
      </button>
    </li>
  )
}

export function ReorderList({
  items,
  label,
  onChange,
}: {
  items: Item[]
  label: string
  /** The ids in their new order, after each move. */
  onChange: (ids: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map((i) => i.id)

  const drop = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={drop}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          aria-label={label}
          className="m-0 flex-none list-none overflow-hidden rounded-input border border-border bg-surface p-0"
        >
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
