import { describe, expect, it } from 'vitest'
import { listNames } from './words'

describe('listNames', () => {
  it('joins up to three and counts the rest', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['IT'])).toBe('IT')
    expect(listNames(['Plumbing', 'Bar'])).toBe('Plumbing and Bar')
    expect(listNames(['Plumbing', 'Bar', 'IT'])).toBe('Plumbing, Bar and IT')
    expect(listNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more')
  })
})
