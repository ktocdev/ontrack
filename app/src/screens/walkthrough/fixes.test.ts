import { describe, expect, it } from 'vitest'
import { addedLine, whereFrom } from './fixes'

describe('whereFrom', () => {
  it('drops the month, which the header already says', () => {
    expect(whereFrom('Oct walkthrough · BOH › Electrical › Outlets')).toBe('BOH › Electrical › Outlets')
    expect(whereFrom('Oct walkthrough · Q4 · Organize utility areas')).toBe('Q4 · Organize utility areas')
  })

  it('leaves anything else as it is', () => {
    expect(whereFrom('Walk-in cooler')).toBe('Walk-in cooler')
    expect(whereFrom(null)).toBeNull()
  })
})

describe('addedLine', () => {
  const now = new Date(2026, 10, 13, 15, 0)
  it('says today, and who by their first name', () => {
    expect(addedLine(new Date(2026, 10, 13, 9, 30).toISOString(), 'Maya Reyes', now)).toBe('Added today by Maya')
  })

  it('names the day otherwise, and leaves out a name it doesn’t have', () => {
    expect(addedLine(new Date(2026, 10, 6, 9, 30).toISOString(), 'Maya Reyes', now)).toBe('Added Nov 6 by Maya')
    expect(addedLine(new Date(2026, 10, 6, 9, 30).toISOString(), null, now)).toBe('Added Nov 6')
  })
})
