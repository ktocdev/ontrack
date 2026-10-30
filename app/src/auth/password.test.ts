import { describe, expect, it } from 'vitest'
import { passwordReady, passwordRules } from './validation'

describe('the Set up account password rules', () => {
  it('lists each rule and whether it is met', () => {
    expect(passwordRules('kitchen4')).toEqual([
      { text: 'At least 12 characters', ok: false },
      { text: 'One number', ok: true },
      { text: 'One uppercase letter', ok: false },
    ])
  })

  it('needs all three', () => {
    expect(passwordReady('Kitchen4Kitchen4')).toBe(true)
    expect(passwordReady('kitchen4kitchen4')).toBe(false)
    expect(passwordReady('KitchenKitchen')).toBe(false)
    expect(passwordReady('Kitchen4')).toBe(false)
  })

  it('refuses what the hash would silently cut off', () => {
    expect(passwordReady(`K4${'a'.repeat(70)}`)).toBe(true)
    expect(passwordReady(`K4${'a'.repeat(71)}`)).toBe(false)
  })
})
