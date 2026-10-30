import { describe, expect, it } from 'vitest'
import { readResetLink } from './useReset'

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
