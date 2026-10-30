import { useState } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useResendInvite, useRevokeInvite, type InviteRow } from './useUsers'

/**
 * What an admin can do to a pending invite, opened from its row. There is no
 * board for it, so it follows the Restaurants sheet: the actions, then a confirm
 * step that says what happens.
 */
export function InviteSheet({ invite: i, onClose }: { invite: InviteRow; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const resend = useResendInvite()
  const revoke = useRevokeInvite()
  const toast = useToast()

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={confirming ? `Revoke ${i.name}'s invite?` : i.name}
      description={
        confirming
          ? 'The link in their email stops working. You can invite them again any time.'
          : `${i.email} · ${i.line}`
      }
    >
      {confirming ? (
        <>
          <Button
            variant="danger"
            loading={revoke.isPending}
            onClick={() =>
              revoke.mutate(i.id, {
                onSuccess: () => {
                  toast.show(`${i.name}'s invite revoked.`)
                  onClose()
                },
              })
            }
          >
            Revoke invite
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button
            loading={resend.isPending}
            onClick={() =>
              resend.mutate(i.id, {
                onSuccess: () => {
                  toast.show(`Invite sent again to ${i.name}.`)
                  onClose()
                },
              })
            }
          >
            Resend invite
          </Button>
          <Button variant="secondary-danger" onClick={() => setConfirming(true)}>
            Revoke invite
          </Button>
        </>
      )}
      {(resend.isError || revoke.isError) && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
    </Sheet>
  )
}
