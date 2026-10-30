import { describe, expect, it } from 'vitest'
import { hasSessionTokens, readResetLink } from './useReset'

describe('hasSessionTokens', () => {
  it('spots the stock Supabase link and nothing else', () => {
    expect(hasSessionTokens('#access_token=abc&type=recovery')).toBe(true)
    expect(hasSessionTokens('#type=recovery&access_token=abc')).toBe(true)
    expect(hasSessionTokens('#token_hash=abc&email=maya@example.com')).toBe(false)
    expect(hasSessionTokens('#email=access_token=abc')).toBe(false)
    expect(hasSessionTokens('')).toBe(false)
  })
})

describe('readResetLink', () => {
  it('reads the token and the email', () => {
    expect(readResetLink('#token_hash=abc123&email=maya.reyes@example.com')).toEqual({
      tokenHash: 'abc123',
      email: 'maya.reyes@example.com',
    })
  })

  it('keeps the + in a plus address', () => {
    expect(readResetLink('#token_hash=abc&email=maya+test1@gmail.com').email).toBe('maya+test1@gmail.com')
  })

  it('decodes what a mail client encoded', () => {
    expect(readResetLink('#token_hash=abc&email=maya%2Btest1%40gmail.com').email).toBe('maya+test1@gmail.com')
  })

  it('comes back empty for a link with nothing useful in it', () => {
    expect(readResetLink('')).toEqual({ tokenHash: '', email: '' })
    expect(readResetLink('#nope')).toEqual({ tokenHash: '', email: '' })
    expect(readResetLink('#token_hash=abc&email=%E0%A4%A').email).toBe('')
  })
})
