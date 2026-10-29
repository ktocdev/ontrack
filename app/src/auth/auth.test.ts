import { afterEach, describe, expect, it } from 'vitest'
import { clearStamp, firstName, isExpired, readStamp, rememberName, SESSION_MAX_MS, stampSignIn } from './session'
import { canSubmitSignIn, looksLikeEmail, signInErrorMessage } from './validation'

describe('sign-in rules', () => {
  it('needs a plausible email and 12 characters of password', () => {
    expect(canSubmitSignIn('maya.reyes@example.com', 'ontrack-demo-2026')).toBe(true)
    expect(canSubmitSignIn('maya.reyes@example.com', 'short-pass1')).toBe(false)
    expect(canSubmitSignIn('maya.reyes', 'ontrack-demo-2026')).toBe(false)
  })

  it('rejects emails with spaces, no domain or no tld', () => {
    for (const bad of ['', 'a b@example.com', 'maya@', '@example.com', 'maya@example', 'maya@example.c']) {
      expect(looksLikeEmail(bad), bad).toBe(false)
    }
    expect(looksLikeEmail('  maya@example.com ')).toBe(true)
  })

  it('turns Supabase errors into plain sentences', () => {
    expect(signInErrorMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toMatch(
      /don't match/,
    )
    expect(signInErrorMessage({ message: 'x', status: 429 })).toMatch(/Too many tries/)
    expect(signInErrorMessage({ message: 'Failed to fetch' })).toMatch(/connection/)
    expect(signInErrorMessage({ message: 'Something odd' })).toBe('Sign in failed. Try again in a moment.')
  })
})

describe('12-hour session cap', () => {
  afterEach(() => clearStamp())

  it('expires 12 hours after a fresh sign-in', () => {
    const t0 = 1_800_000_000_000
    const stamp = stampSignIn('u1', 'maya@example.com', { fresh: true }, t0)
    expect(isExpired(stamp, 'u1', t0 + SESSION_MAX_MS - 1)).toBe(false)
    expect(isExpired(stamp, 'u1', t0 + SESSION_MAX_MS)).toBe(true)
  })

  it('keeps the clock when a session is restored, restarts it on a fresh sign-in', () => {
    stampSignIn('u1', 'maya@example.com', { fresh: true }, 1000)
    expect(stampSignIn('u1', 'maya@example.com', { fresh: false }, 5000).at).toBe(1000)
    expect(stampSignIn('u1', 'maya@example.com', { fresh: true }, 9000).at).toBe(9000)
  })

  it('starts a new clock for a different person', () => {
    stampSignIn('u1', 'maya@example.com', { fresh: true }, 1000)
    const other = stampSignIn('u2', 'ari@example.com', { fresh: false }, 5000)
    expect(other.at).toBe(5000)
    expect(isExpired(other, 'u1', 1000 + SESSION_MAX_MS)).toBe(false)
  })

  it('remembers the name for the signed-out sheet', () => {
    stampSignIn('u1', 'maya@example.com', { fresh: true })
    rememberName('u1', 'Maya Reyes')
    expect(firstName(readStamp()?.name)).toBe('Maya')
    rememberName('u2', 'Someone Else')
    expect(readStamp()?.name).toBe('Maya Reyes')
  })
})
