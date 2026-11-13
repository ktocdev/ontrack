import { Button } from '../../components/Button'
import { ErrorBanner } from '../../components/Notice'
import { ConfirmSheet } from '../../components/Sheet'
import { IconTrash } from '../../components/icons'
import { useDeleteTask } from './useInHouse'

/**
 * Delete an in-house task or fix, after a confirm step: only one never checked off, which
 * the database also enforces. Used by the In-house tab and a walkthrough's fix list.
 */
export function DeleteTaskSheet({
  task,
  onClose,
  onDeleted,
}: {
  /** The task to delete; nothing keeps the sheet closed. */
  task: { id: string; title: string } | null
  onClose: () => void
  onDeleted: () => void
}) {
  const remove = useDeleteTask()
  return (
    <ConfirmSheet
      open={task !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          remove.reset()
          onClose()
        }
      }}
      title="Delete this in-house task?"
      icon={
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-open-bg text-danger">
          <IconTrash size={24} />
        </span>
      }
      description={
        <span className="flex flex-col gap-2">
          <span>"{task?.title}" will be removed.</span>
          <b className="text-danger">This is permanent and cannot be undone.</b>
        </span>
      }
    >
      {remove.isError && (
        <ErrorBanner title="Couldn't delete this yet.">
          It may have just been checked off, or your connection dropped. Try again.
        </ErrorBanner>
      )}
      <Button
        variant="danger"
        loading={remove.isPending}
        onClick={() => task && remove.mutate(task.id, { onSuccess: onDeleted })}
      >
        Delete
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    </ConfirmSheet>
  )
}
