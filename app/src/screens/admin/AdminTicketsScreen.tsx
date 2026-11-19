import { useState } from 'react'
import { ticketPlace } from '../../app/areas'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { EmptyState } from '../../components/EmptyState'
import { SearchField } from '../../components/Field'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { IconCheckCircle, IconEye, IconSearchOff, IconWarning } from '../../components/icons'
import { shortDay } from '../../lib/words'
import { ago, scheduledLabel } from '../tickets/tickets'
import { AdminHeader } from './AdminHeader'
import { matchesTicket } from './adminTickets'
import { CLOSED_SHOWN, useAdminTickets, type AdminTicket } from './useAdminTickets'

/**
 * Admin · Tickets (design/screens/Admin-Tickets, OT-148), the plain Admin role's Tickets
 * tab. View only: Ops works tickets, and an admin writes nothing in a thread
 * (can_post_on_ticket()). Open lists every open ticket as the Ops dashboard orders them,
 * urgent first; Closed lists the latest closed. The restaurant chip narrows both, for this
 * visit only. Search finds a title, unit, category or number. Each card names its
 * restaurant and who is working on it (the board's Assigned; nobody assigns since OT-48),
 * else how long ago it was opened, and opens the read-only ticket. Scoped from useUser().
 */
export function AdminTicketsScreen() {
  const { restaurants, viewingAs } = useUser()
  const roles = useRoleNames()
  const [closed, setClosed] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const selected = restaurants.find((r) => r.id === restaurantId) ?? null
  const ids = selected ? [selected.id] : restaurants.map((r) => r.id)
  const { data, isPending, isError, refetch } = useAdminTickets(ids, closed)
  const [now] = useState(() => new Date())

  const tickets = data ?? []
  const shown = tickets.filter((t) => matchesTicket(t, query))
  const q = query.trim()
  const byId = new Map(restaurants.map((r) => [r.id, r]))

  const meta = (t: AdminTicket) =>
    [
      ...ticketPlace(t),
      closed
        ? t.closed_at && `Closed ${shortDay(new Date(t.closed_at))}`
        : (t.assignee?.full_name ?? ago(new Date(t.created_at), now)),
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <Screen>
      <AdminHeader title="Tickets">
        <SearchField
          label="Search tickets"
          placeholder="Search tickets, equipment or OT-"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
        />
        <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none]">
          <Chip selected={!closed} onClick={() => setClosed(false)}>
            {!closed && data ? `Open · ${tickets.length}` : 'Open'}
          </Chip>
          <Chip selected={closed} onClick={() => setClosed(true)}>
            Closed
          </Chip>
          <RestaurantPicker
            chip
            restaurants={restaurants}
            selectedId={restaurantId}
            onSelect={setRestaurantId}
            heading="Show tickets for"
          />
        </div>
        <p className="flex items-center gap-2 text-13 text-text-secondary">
          <IconEye size={16} className="flex-none" />
          View only · {roles.name('ops', 'Ops')} manages tickets
        </p>
      </AdminHeader>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load tickets"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : !isPending && tickets.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={22}
            icon={<IconCheckCircle size={30} />}
            title={closed ? 'No closed tickets' : 'No open tickets'}
            body={
              closed
                ? `Tickets ${roles.name('ops', 'Ops')} closes show up here.`
                : `Nothing is open ${selected ? `at ${selected.name}` : 'at any restaurant'}. New tickets show up here, most urgent first.`
            }
          />
        </ScreenEmpty>
      ) : !isPending && shown.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            icon={<IconSearchOff size={30} />}
            title={`No tickets match "${q}"`}
            body={`None of these ${closed ? 'closed' : 'open'} tickets match that title, equipment or number.`}
          >
            <Button variant="secondary" className="w-full" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-3 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton />
          ) : (
            <>
              {shown.map((t) => {
                const r = byId.get(t.restaurant_id)
                return (
                  <OpsTicketCard
                    key={t.id}
                    to={viewingAs ? undefined : `/admin/tickets/${t.id}`}
                    displayId={t.display_id ?? ''}
                    title={t.title}
                    status={t.status}
                    statusLabel={
                      t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                    }
                    urgent={!closed && t.urgency === 'urgent'}
                    walkthrough={t.source === 'walkthrough'}
                    restaurant={r && { name: r.name, color: r.color }}
                    meta={meta(t)}
                  />
                )
              })}
              {closed && tickets.length >= CLOSED_SHOWN && (
                <p className="py-2 text-center text-13 text-text-muted">
                  The latest {CLOSED_SHOWN} closed tickets. Search or pick a restaurant to narrow them.
                </p>
              )}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}
