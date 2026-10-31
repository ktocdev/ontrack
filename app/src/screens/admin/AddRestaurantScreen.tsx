import { useNavigate } from 'react-router'
import { useToast } from '../../components/Toast'
import { RestaurantForm, RestaurantFormLoading } from './RestaurantForm'
import { useAddRestaurant, useAdminRestaurants } from './useRestaurants'

/**
 * Admin · Add restaurant (design/screens/Admin-Add-Restaurant). Saving gives the
 * manager access to the new restaurant. "+ Invite a new manager" goes on to
 * Invite user after saving, with the new restaurant already picked.
 */
export function AddRestaurantScreen() {
  const { data, isPending } = useAdminRestaurants()
  const navigate = useNavigate()
  const toast = useToast()
  const add = useAddRestaurant()

  if (isPending || !data) return <RestaurantFormLoading title="Add restaurant" />

  return (
    <RestaurantForm
      title="Add restaurant"
      submitLabel="Save restaurant"
      taken={data.restaurants.map((r) => r.color.toLowerCase())}
      managers={data.managers}
      saving={add.isPending}
      error={add.error}
      // An error is about what was sent, so it goes as soon as that changes.
      clearError={() => {
        if (add.isError) add.reset()
      }}
      onSave={({ managerId, ...values }) => {
        const inviting = managerId === 'invite'
        add.mutate(
          { ...values, managerId: inviting ? null : managerId || null },
          {
            onSuccess: (id) => {
              toast.show(`${values.name} added.`)
              navigate(inviting ? `/admin/users/new?restaurant=${id}` : '/admin/restaurants')
            },
          },
        )
      }}
    />
  )
}
