import { describe, expect, it } from 'vitest'
import { listNames } from './words'

describe('listNames', () => {
  it('joins names with a comma and a last and', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['IT'])).toBe('IT')
    expect(listNames(['Plumbing', 'Bar'])).toBe('Plumbing and Bar')
    expect(listNames(['Plumbing', 'Bar', 'IT'])).toBe('Plumbing, Bar and IT')
    expect(listNames(['A', 'B', 'C', 'D'])).toBe('A, B, C and D')
  })
})
