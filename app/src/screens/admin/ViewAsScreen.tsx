import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ROLE_TABS } from '../../app/roles'
import { TabBar } from '../../components/TabBar'
import { Spinner } from '../../components/Skeleton'
import { IconEye, IconReport } from '../../components/icons'
import { AuthContext, useUser } from '../../auth/context'
import { firstName } from '../../auth/session'
import type { SignedIn } from '../../auth/types'
import type { AppRole } from '../../lib/supabase'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { PlaceholderScreen } from '../placeholder/PlaceholderScreen'
import { ReportSheet } from '../profile/ReportSheet'
import { OpsDashboardScreen } from '../ops/OpsDashboardScreen'
import { OpenTicketsScreen } from '../tickets/OpenTicketsScreen'
import { useLogViewAs, usePerson } from './useRights'

/**
 * Admin · View as (design/screens/View-As): someone's home screen as they see it,
 * under a banner, with the visit in the audit log. No token changes hands: the
 * admin stays signed in as themselves and nothing is impersonated, so the database
 * still answers as the admin. What differs is what useUser() says, which is how
 * screens know whose restaurants to show. A screen that loads data must scope it
 * from useUser(), and one that writes must hide its controls when viewingAs is set.
 * Leadership's home is a placeholder until Phase 7 replaces it here.
 */

export function ViewAsScreen() {
  const { id = '' } = useParams()
  const me = useUser()
  const person = usePerson(id)
  const logged = useLogViewAs(id)
  const [reporting, setReporting] = useState(false)

  const viewed = useMemo<SignedIn | null>(() => {
    if (!person.data) return null
    const { profile, allRestaurants, restaurantIds } = person.data
    return {
      ...me,
      user: profile,
      restaurants: allRestaurants ? me.restaurants : me.restaurants.filter((r) => restaurantIds.includes(r.id)),
      allRestaurants,
      viewingAs: true,
    }
  }, [person.data, me])

  if (person.isPending || logged.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  // Admins, the deactivated and unknown people can't be viewed; the database refused to log it.
  if (!viewed || logged.isError || viewed.user.role === 'admin') return <NotFoundScreen />

  const role = viewed.user.role as Exclude<AppRole, 'admin'>
  const first = firstName(viewed.user.full_name) ?? viewed.user.full_name
  const tabs = ROLE_TABS[role]

  return (
    <>
      <ViewAsBanner name={viewed.user.full_name} first={first} exitTo={`/admin/users/${id}`} />
      <div className="flex flex-none justify-end px-3 pt-1.5">
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex min-h-9 items-center gap-1.5 text-13 font-semibold text-status-progress-text"
        >
          <IconReport size={15} />
          Report a problem to support
        </button>
      </div>
      <AuthContext.Provider value={viewed}>
        {role === 'manager' ? (
          <OpenTicketsScreen />
        ) : role === 'ops' ? (
          <OpsDashboardScreen />
        ) : (
          <PlaceholderScreen title="Overview" phase="Phase 7" />
        )}
        <TabBar label={tabs.label} items={tabs.items} inert />
      </AuthContext.Provider>
      <ReportSheet open={reporting} onOpenChange={setReporting} context={`Viewing as ${viewed.user.full_name}`} />
    </>
  )
}

/** The banner across the top while viewing as someone: who, that it is read-only, and the way out. */
export function ViewAsBanner({ name, first, exitTo }: { name: string; first: string; exitTo: string }) {
  return (
    <div
      role="region"
      aria-label="Viewing as another user"
      className="flex flex-none items-center gap-2.5 bg-banner-info pb-2.5 pl-4 pr-3 pt-[calc(10px+var(--safe-top))] text-white"
    >
      <IconEye size={18} className="flex-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-13 font-bold">Viewing as {name}</span>
        <span className="text-12 opacity-85">Read-only · nothing you tap changes {first}&apos;s data</span>
      </div>
      <Link
        to={exitTo}
        className="flex min-h-9 flex-none items-center rounded-segment bg-white px-3 text-13 font-bold text-banner-info no-underline hover:text-banner-info"
      >
        Exit
      </Link>
    </div>
  )
}
