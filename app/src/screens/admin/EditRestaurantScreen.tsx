import { useNavigate, useParams } from 'react-router'
import { useToast } from '../../components/Toast'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { RestaurantForm, RestaurantFormLoading } from './RestaurantForm'
import { useAdminRestaurants, useUpdateRestaurant } from './useRestaurants'

/**
 * Admin · Edit restaurant, opened from a restaurant's sheet. There is no board
 * for it, so it is the Add form filled in, without the manager: who runs a
 * restaurant follows from their account, on User profile.
 */
export function EditRestaurantScreen() {
  const { id } = useParams()
  const { data, isPending } = useAdminRestaurants()
  const navigate = useNavigate()
  const toast = useToast()
  const update = useUpdateRestaurant()

  if (isPending || !data) return <RestaurantFormLoading title="Edit restaurant" />
  const restaurant = data.restaurants.find((r) => r.id === id)
  if (!restaurant) return <NotFoundScreen />

  return (
    <RestaurantForm
      // Saving refreshes the list, which must not reset a form still on screen.
      key={restaurant.id}
      title="Edit restaurant"
      submitLabel="Save changes"
      taken={data.restaurants.filter((r) => r.id !== restaurant.id).map((r) => r.color.toLowerCase())}
      initial={{
        name: restaurant.name,
        address: restaurant.address ?? '',
        phone: restaurant.phone ?? '',
        color: restaurant.color,
      }}
      saving={update.isPending}
      error={update.error}
      clearError={() => {
        if (update.isError) update.reset()
      }}
      onSave={({ name, address, phone, color }) =>
        update.mutate(
          { id: restaurant.id, name, address, phone, color },
          {
            onSuccess: () => {
              toast.show(`${name} saved.`)
              navigate('/admin/restaurants')
            },
          },
        )
      }
    />
  )
}
