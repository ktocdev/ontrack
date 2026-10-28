import type { Tables } from '../lib/supabase'

export type Profile = Tables<'profiles'>
export type Restaurant = Tables<'restaurants'>

export type SignedIn = {
  status: 'signed-in'
  user: Profile
  /** Restaurants in scope, in sort order. Managers get their own; others get all. */
  restaurants: Restaurant[]
  /** True when the membership row is the all-restaurants row. */
  allRestaurants: boolean
  signOut: () => Promise<void>
}

export type AuthState =
  /** No VITE_SUPABASE_* in this build. */
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** Auth session exists but no profile row is visible: deactivated, or not yet invited. */
  | { status: 'no-profile'; email: string | null; signOut: () => Promise<void> }
  | SignedIn
