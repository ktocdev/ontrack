import { useState } from 'react'
import { ButtonLink } from '../../components/Button'
import { ListCard, ListRowLink } from '../../components/Card'
import { RoleTag } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { IconChevronRight, IconPlus } from '../../components/icons'
import { AdminHeader } from './AdminHeader'
import { RestaurantSheet } from './RestaurantSheet'
import { useAdminRestaurants, type AdminRestaurant } from './useRestaurants'

/**
 * Admin · Restaurants (design/screens/Admin-Restaurants). Every restaurant
 * with its color, open ticket count, manager (or the pending invite for one)
 * and address; Add opens the form. Tapping a row offers Edit, Archive (or
 * Restore) and Delete; archived restaurants sit in their own section below.
 */
export function RestaurantsScreen() {
  const { data, isPending } = useAdminRestaurants()
  // The sheet keeps its own copy: after a delete the list refreshes without the
  // restaurant, and the sheet must stay mounted long enough to confirm it.
  const [selected, setSelected] = useState<AdminRestaurant | null>(null)
  const active = data?.restaurants.filter((r) => !r.archived) ?? []
  const archived = data?.restaurants.filter((r) => r.archived) ?? []
  const count = data ? active.length : undefined

  return (
    <Screen>
      <AdminHeader
        title="Restaurants"
        action={
          <ButtonLink to="/admin/restaurants/new" variant="compact" icon={<IconPlus size={18} />}>
            Add
          </ButtonLink>
        }
      >
        <span className="text-13 text-text-secondary">
          {count === undefined
            ? 'Each color shows up wherever the restaurant is named'
            : `${count} ${count === 1 ? 'restaurant' : 'restaurants'} · each color shows up wherever the restaurant is named`}
        </span>
      </AdminHeader>

      <ScreenBody className="pb-4 pt-1">
        {isPending ? (
          <PeopleListSkeleton count={4} />
        ) : (
          <>
            <ListCard>
              {active.map((r) => (
                <RestaurantRow key={r.id} restaurant={r} onOpen={() => setSelected(r)} />
              ))}
            </ListCard>
            {archived.length > 0 && (
              <>
                <SectionLabel className="pb-3">Archived</SectionLabel>
                <ListCard>
                  {archived.map((r) => (
                    <RestaurantRow key={r.id} restaurant={r} onOpen={() => setSelected(r)} />
                  ))}
                </ListCard>
              </>
            )}
            <SectionLabel className="pb-3">Shared by every restaurant</SectionLabel>
            <ListCard>
              <ListRowLink
                to="/admin/restaurants/categories"
                title="Categories"
                subtitle="What tickets and equipment are sorted by"
                trailing={<IconChevronRight className="text-text-muted" />}
              />
            </ListCard>
          </>
        )}
      </ScreenBody>
      {selected && <RestaurantSheet restaurant={selected} onClose={() => setSelected(null)} />}
    </Screen>
  )
}

/** 12px 14px row: 14px square top-aligned, 15px name with the open count, manager, address. */
function RestaurantRow({ restaurant: r, onOpen }: { restaurant: AdminRestaurant; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-t border-border px-3.5 py-3 text-left text-text transition-colors first:border-t-0 hover:bg-surface-hover active:bg-surface-muted active:duration-0"
    >
      <RestaurantSquare color={r.color} size={14} className="mt-1 self-start" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-start justify-between gap-2">
          <span className={`min-w-0 text-15 font-semibold leading-[1.3] ${r.archived ? 'text-text-secondary' : ''}`}>
            {r.name}
          </span>
          <RoleTag>{r.archived ? 'Archived' : `${r.openCount} open`}</RoleTag>
        </span>
        <span className="text-13 text-text-body">
          {r.manager.kind === 'none' ? (
            'No manager yet'
          ) : (
            <>
              Manager: {r.manager.name}
              {r.manager.kind === 'invite' && (
                <>
                  {' · '}
                  <span
                    className={`font-semibold ${r.manager.expired ? 'text-status-open-text' : 'text-status-waiting-text'}`}
                  >
                    {r.manager.expired ? 'Invite expired' : 'Invite pending'}
                  </span>
                </>
              )}
            </>
          )}
        </span>
        {r.address && <span className="text-12 text-text-muted">{r.address}</span>}
      </div>
    </button>
  )
}
