import { shareLink, ticketLink } from '../lib/share'
import { OverflowMenu, type MenuItem } from './Menu'
import { useToast } from './Toast'

/**
 * The menu on a ticket's header: anything the screen adds, then Share link, which is the
 * phone's share sheet or a copy on a computer. No board draws it.
 */
export function TicketMenu({
  id,
  displayId,
  title,
  items = [],
}: {
  id: string
  displayId: string
  title: string
  items?: MenuItem[]
}) {
  const toast = useToast()
  const share = async () => {
    const result = await shareLink(ticketLink(id), `${displayId} · ${title}`)
    if (result === 'copied') toast.show('Link copied.')
    if (result === 'failed') toast.show('Couldn’t copy the link. Try again.')
  }
  return (
    <OverflowMenu
      label="More options for this ticket"
      items={[...items, { label: 'Share link', onSelect: () => void share() }]}
    />
  )
}
