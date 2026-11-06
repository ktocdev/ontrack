import { equipmentLink, shareLink, ticketLink } from '../lib/share'
import { OverflowMenu, type MenuItem } from './Menu'
import { useToast } from './Toast'

/**
 * The menu on a ticket's or a unit's header: anything the screen adds, then Share link,
 * which is the phone's share sheet or a copy on a computer. No board draws it.
 */
function ShareMenu({
  label,
  url,
  shareTitle,
  items,
}: {
  label: string
  url: string
  shareTitle: string
  items: MenuItem[]
}) {
  const toast = useToast()
  const share = async () => {
    const result = await shareLink(url, shareTitle)
    if (result === 'copied') toast.show('Link copied.')
    if (result === 'failed') toast.show('Couldn’t copy the link. Try again.')
  }
  return <OverflowMenu label={label} items={[...items, { label: 'Share link', onSelect: () => void share() }]} />
}

export function TicketMenu({ displayId, title, items = [] }: { displayId: string; title: string; items?: MenuItem[] }) {
  return (
    <ShareMenu
      label="More options for this ticket"
      url={ticketLink(displayId)}
      shareTitle={`${displayId} · ${title}`}
      items={items}
    />
  )
}

/** A unit's menu, with Share link to /e/<id> (OT-71). */
export function EquipmentMenu({ id, name, items = [] }: { id: string; name: string; items?: MenuItem[] }) {
  return <ShareMenu label="More options for this equipment" url={equipmentLink(id)} shareTitle={name} items={items} />
}
