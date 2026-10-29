import { ButtonLink } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { RoleTag } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody } from '../../components/Screen'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { IconPlus } from '../../components/icons'
import { AdminHeader } from './AdminHeader'
import { useAdminRestaurants, type AdminRestaurant } from './useRestaurants'

/**
 * Admin · Restaurants (design/screens/Admin-Restaurants). Every restaurant
 * with its color, open ticket count, manager (or the pending invite for one)
 * and address; Add opens the form.
 */
export function RestaurantsScreen() {
  const { data, isPending } = useAdminRestaurants()
  const count = data?.restaurants.length

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
          <ListCard>
            {data!.restaurants.map((r) => (
              <RestaurantRow key={r.id} restaurant={r} />
            ))}
          </ListCard>
        )}
      </ScreenBody>
    </Screen>
  )
}

/** 12px 14px row: 14px square top-aligned, 15px name with the open count, manager, address. */
function RestaurantRow({ restaurant: r }: { restaurant: AdminRestaurant }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
      <RestaurantSquare color={r.color} size={14} className="mt-1 self-start" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-15 font-semibold leading-[1.3]">{r.name}</span>
          <RoleTag>{r.openCount} open</RoleTag>
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
    </div>
  )
}
