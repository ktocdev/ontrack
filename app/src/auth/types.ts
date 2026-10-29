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
  /**
   * The session ended without the person signing out: the 12-hour cap, or a
   * revoked refresh token. The current route stays put and the signed-out
   * sheet asks for the password again. dismiss() is "Not you?".
   */
  | { status: 'expired'; email: string; name?: string; dismiss: () => void }
  /** Auth session exists but no profile row is visible: deactivated, or not yet invited. */
  | { status: 'no-profile'; email: string | null; signOut: () => Promise<void> }
  | SignedIn
