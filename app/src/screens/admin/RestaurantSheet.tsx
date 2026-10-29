import { useState } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useDeleteRestaurant, useSetArchived, type AdminRestaurant } from './useRestaurants'

/**
 * What an admin can do to one restaurant, opened from its row. There is no
 * board for it, so it follows the confirm-sheet pattern (Admin-Roles "Save 2
 * changes?"): a menu, then a confirm step that says exactly what happens.
 * Delete is offered only when the database would allow it.
 */
type Step = 'menu' | 'archive' | 'delete'

export function RestaurantSheet({ restaurant: r, onClose }: { restaurant: AdminRestaurant; onClose: () => void }) {
  const [step, setStep] = useState<Step>('menu')
  const archive = useSetArchived()
  const remove = useDeleteRestaurant()
  const toast = useToast()

  const close = () => {
    setStep('menu')
    archive.reset()
    remove.reset()
    onClose()
  }
  const failed = archive.isError || remove.isError

  const setArchived = (archived: boolean) =>
    archive.mutate(
      { id: r.id, archived },
      {
        onSuccess: () => {
          toast.show(archived ? `${r.name} archived.` : `${r.name} restored.`)
          close()
        },
      },
    )

  const content =
    step === 'archive' ? (
      <>
        <Button onClick={() => setArchived(true)} loading={archive.isPending}>
          Archive restaurant
        </Button>
        <Button variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </>
    ) : step === 'delete' ? (
      <>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(r.id, {
              onSuccess: () => {
                toast.show(`${r.name} deleted.`)
                close()
              },
            })
          }
        >
          Delete restaurant
        </Button>
        <Button variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </>
    ) : (
      <>
        {r.archived ? (
          <Button onClick={() => setArchived(false)} loading={archive.isPending}>
            Restore restaurant
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setStep('archive')}>
            Archive restaurant
          </Button>
        )}
        <Button variant="secondary-danger" disabled={r.keepReason !== null} onClick={() => setStep('delete')}>
          Delete restaurant
        </Button>
        {r.keepReason && <span className="-mt-1.5 text-13 text-text-secondary">{r.keepReason}</span>}
      </>
    )

  const title = step === 'archive' ? `Archive ${r.name}?` : step === 'delete' ? `Delete ${r.name}?` : r.name
  const description =
    step === 'archive'
      ? 'It leaves everyone’s lists, and nobody can add tickets, equipment or walkthroughs there. Its history stays, and you can restore it any time.'
      : step === 'delete'
        ? 'This removes it for good. It has no tickets, equipment or walkthroughs, so nothing else is lost.'
        : r.archived
          ? 'Archived. It is hidden from everyone’s lists and takes nothing new.'
          : (r.address ?? undefined)

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title={title} description={description}>
      {content}
      {failed && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
    </Sheet>
  )
}
