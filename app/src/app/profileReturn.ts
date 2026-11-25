import { safeReturnPath } from '../auth/returnPath'

/**
 * Where Profile's Back goes (from feedback, Nov 24, 2026, OT-176): the screen Profile was
 * opened from, not home. The avatar in a header and the sidebar's foot pass it in history
 * state (`profileFrom`), so it survives a reload of Profile; Profile also remembers it for the
 * visit, so coming back from My categories, Help or Backup codes, whose Back is a plain link
 * to /profile, still finds it. Home only when Profile was opened on its own.
 */
// Kept with whose it is, so someone signing in after them in the same tab starts at home.
let remembered: { userId: string; path: string } | null = null

/** The state for a link to Profile from the current address. */
export const profileFrom = (pathname: string, search = '') => ({ from: `${pathname}${search}` })

/** Where Back goes from Profile, given its history state; remembers it for the sub-screens. */
export function profileBack(state: unknown, home: string, userId: string) {
  const passed = (state as { from?: unknown } | null)?.from
  const from = typeof passed === 'string' ? safeReturnPath(passed) : null
  // Never back into Profile itself.
  if (from && !/^\/profile(\/|$)/.test(from)) remembered = { userId, path: from }
  return remembered?.userId === userId ? remembered.path : home
}
