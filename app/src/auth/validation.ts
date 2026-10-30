/** Matches config.toml's minimum_password_length; the database enforces it too. */
export const MIN_PASSWORD = 12

/** Past this the password hash silently ignores the rest, so it is refused instead. */
export const MAX_PASSWORD = 72

/** Set up account's checklist. The invite-user function holds the same rules. */
export function passwordRules(password: string) {
  return [
    { text: `At least ${MIN_PASSWORD} characters`, ok: password.length >= MIN_PASSWORD },
    { text: 'One number', ok: /\d/.test(password) },
    { text: 'One uppercase letter', ok: /[A-Z]/.test(password) },
  ]
}

export function passwordReady(password: string) {
  return password.length <= MAX_PASSWORD && passwordRules(password).every((r) => r.ok)
}

/** Something@something.tld, no spaces. The server is the real check. */
export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** The Sign in button's rule: a plausible email and a long-enough password. */
export function canSubmitSignIn(email: string, password: string) {
  return looksLikeEmail(email) && password.length >= MIN_PASSWORD
}

/** Supabase's wording is for developers; these are for the people signing in. */
export function signInErrorMessage(error: { message: string; status?: number; code?: string }) {
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return "That email and password don't match. Check both and try again."
  }
  if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
    return 'Too many tries. Wait a few minutes, then try again.'
  }
  if (error.code === 'user_banned') return 'This account has been turned off. Ask your admin.'
  if (/fetch|network/i.test(error.message)) return "Can't reach OnTrack. Check your connection and try again."
  return 'Sign in failed. Try again in a moment.'
}
