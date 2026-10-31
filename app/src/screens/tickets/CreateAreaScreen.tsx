import { useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { CategoryTile } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Select } from '../../components/Field'
import { RestaurantName } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { Sk } from '../../components/Skeleton'
import { IconStorefront } from '../../components/icons'
import { useCategories } from './useCreateTicket'

/**
 * Manager · Create ticket: area (design/screens/Create-Area). Front or Back of House,
 * then a category with how many units it has here. The area and restaurant live in
 * the address, so coming back from the form keeps them. Someone with more than one
 * restaurant picks which, which has no board. Scan a QR code waits for Phase 4.
 */
type Area = 'foh' | 'boh'

export function CreateAreaScreen() {
  const { user, restaurants } = useUser()
  const [params, setParams] = useSearchParams()
  const area: Area = params.get('area') === 'foh' ? 'foh' : 'boh'
  const restaurant =
    restaurants.find((r) => r.id === params.get('restaurant')) ??
    restaurants.find((r) => r.id === user.home_restaurant_id) ??
    restaurants[0]
  const { data } = useCategories(restaurant?.id)

  const set = (next: { area?: Area; restaurant?: string }) =>
    setParams(
      { area: next.area ?? area, ...(restaurant ? { restaurant: next.restaurant ?? restaurant.id } : {}) },
      { replace: true },
    )

  if (!restaurant) {
    return (
      <Screen>
        <ScreenHeader title="Create a ticket" />
        <EmptyState
          titleSize={20}
          icon={<IconStorefront size={30} />}
          title="No restaurant yet"
          body="A ticket belongs to a restaurant, and your account doesn't have one. Ask your admin."
        />
      </Screen>
    )
  }

  const here = `area=${area}&restaurant=${restaurant.id}`
  return (
    <Screen>
      <ScreenHeader
        title="Create a ticket"
        topLeft={
          restaurants.length === 1 ? <RestaurantName name={restaurant.name} color={restaurant.color} /> : undefined
        }
      >
        {restaurants.length > 1 && (
          <Select label="Restaurant" value={restaurant.id} onChange={(e) => set({ restaurant: e.target.value })}>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        )}
        <Segmented
          label="Area"
          value={area}
          onChange={(value) => set({ area: value })}
          options={[
            { value: 'foh', label: 'Front of House' },
            { value: 'boh', label: 'Back of House' },
          ]}
        />
      </ScreenHeader>
      <ScreenBody className="pb-4 pt-1">
        <div className="grid grid-cols-2 gap-2.5">
          {data
            ? data
                .filter((c) => c.area === area)
                .map((c) => (
                  <CategoryTile key={c.id} to={`/tickets/new/${c.id}?${here}`} name={c.name} count={c.count} />
                ))
            : Array.from({ length: 8 }).map((_, i) => <Sk key={i} h={76} r={14} />)}
        </div>
      </ScreenBody>
    </Screen>
  )
}
