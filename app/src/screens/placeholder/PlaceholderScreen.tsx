import { ProfileLink } from '../../app/ProfileLink'
import { Card } from '../../components/Card'
import { AllRestaurantsSquare, RestaurantName } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { IconEye } from '../../components/icons'
import { useUser } from '../../auth/context'

/**
 * Stand-in for a screen a later phase builds. It renders the real header for
 * the role (restaurant name or picker, avatar, 30px title) so the frame can
 * be tried on a phone now, and says which phase replaces it.
 */
export function PlaceholderScreen({ title, phase, note }: { title: string; phase: string; note?: string }) {
  const { user, restaurants, allRestaurants } = useUser()
  const home = restaurants.find((r) => r.id === user.home_restaurant_id) ?? restaurants[0]
  const readOnly = user.role === 'leadership'

  const topLeft = allRestaurants ? (
    <span className="flex items-center gap-1.5 text-14 font-semibold">
      {user.role === 'admin' || user.role === 'leadership' ? (
        <span className={user.role === 'admin' ? 'eyebrow' : 'text-13 font-semibold text-text-secondary'}>
          4C | Four Corners
        </span>
      ) : (
        <>
          <AllRestaurantsSquare colors={restaurants.map((r) => r.color)} />
          All restaurants ({restaurants.length})
        </>
      )}
    </span>
  ) : home ? (
    <RestaurantName name={home.name} color={home.color} />
  ) : null

  return (
    <Screen>
      {readOnly && (
        <div className="flex min-h-9 items-center justify-center gap-2 bg-text text-12 font-bold tracking-[.04em] text-bg">
          <IconEye />
          READ-ONLY VIEW
        </div>
      )}
      <ScreenHeader title={title} topLeft={topLeft} topRight={<ProfileLink />} />
      <ScreenBody className="gap-3 pb-6">
        <Card className="flex flex-col gap-1.5 p-4">
          <span className="eyebrow">Coming in {phase}</span>
          <p className="text-14 leading-normal text-text-body">
            {note ??
              `This screen is built in ${phase}. The frame around it, the tab bar and sign-in are the Phase 0 foundation.`}
          </p>
        </Card>
      </ScreenBody>
    </Screen>
  )
}
