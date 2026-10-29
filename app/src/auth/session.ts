/**
 * OnTrack signs people out 12 hours after they sign in. The hosted project is
 * on Supabase Free, which has no server-side session time-box, so the app
 * keeps the sign-in time on the device and ends the session itself. That is a
 * UX rule, not a security boundary: deactivation (can(), has_scope()) and
 * revoke-user's ban are what actually cut a person off.
 */
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000

const KEY = 'ontrack.signedIn'

export type SignInStamp = { userId: string; at: number; email: string; name?: string }

export function readStamp(): SignInStamp | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<SignInStamp>
    return typeof v.userId === 'string' && typeof v.at === 'number' && typeof v.email === 'string'
      ? (v as SignInStamp)
      : null
  } catch {
    return null
  }
}

function write(stamp: SignInStamp) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamp))
  } catch {
    // Private mode or storage blocked: the 12-hour cap just does not apply.
  }
}

/**
 * Record when this user signed in. A fresh sign-in restarts the clock; a
 * session restored on load keeps the existing stamp for the same user.
 */
export function stampSignIn(userId: string, email: string, { fresh }: { fresh: boolean }, now = Date.now()) {
  const current = readStamp()
  if (!fresh && current?.userId === userId) return current
  const stamp = { userId, at: now, email }
  write(stamp)
  return stamp
}

/** Keep the name so the signed-out sheet can say "Not Maya?". */
export function rememberName(userId: string, name: string) {
  const current = readStamp()
  if (current?.userId === userId && current.name !== name) write({ ...current, name })
}

export function clearStamp() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

export function isExpired(stamp: SignInStamp | null, userId: string, now = Date.now()) {
  return Boolean(stamp && stamp.userId === userId && now - stamp.at >= SESSION_MAX_MS)
}

export function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] || undefined
}
