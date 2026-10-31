import type { Tables } from '../lib/supabase'
import type { TwoStep } from './twoStep'

export type Profile = Tables<'profiles'>
export type Restaurant = Tables<'restaurants'>

export type SignedIn = {
  status: 'signed-in'
  user: Profile
  /** Restaurants in scope, in sort order. Managers get their own; others get all. */
  restaurants: Restaurant[]
  /** True when the membership row is the all-restaurants row. */
  allRestaurants: boolean
  /** True under an admin's View as: `user` is the person viewed, and screens must not write. */
  viewingAs?: boolean
  /** The signed-in person's own 2-step state, for the Profile row. */
  twoStep: TwoStep
  signOut: () => Promise<void>
}

export type AuthState =
  /** No VITE_SUPABASE_* in this build. */
  | { status: 'unconfigured' }
  | { status: 'loading' }
  /** `deliberate`: they just signed out, so signing back in starts at home, not on the page they left. */
  | { status: 'signed-out'; deliberate?: boolean }
  /**
   * The session ended without the person signing out: the 12-hour cap, or a
   * revoked refresh token. The current route stays put and the signed-out
   * sheet asks for the password again. dismiss() is "Not you?".
   */
  | { status: 'expired'; email: string; name?: string; dismiss: () => void }
  /** The profile could not be loaded (network, server). Not the same as having none. */
  | { status: 'error'; error: unknown; retry: () => void; signOut: () => Promise<void> }
  /** Auth session exists but no profile row is visible: deactivated, or not yet invited. */
  | { status: 'no-profile'; email: string | null; signOut: () => Promise<void> }
  /** Signed in with a password, but the database answers nothing until the second step is done. */
  | { status: 'two-step'; gate: 'challenge' | 'setup'; signOut: () => Promise<void> }
  | SignedIn
