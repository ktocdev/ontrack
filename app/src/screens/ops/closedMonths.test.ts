import { describe, expect, it } from 'vitest'
import { byReopenedThenNewest, monthKey, monthName, monthRange, shownMonths, type ClosedMonth } from './closedMonths'

const now = new Date(2026, 10, 2, 12)
const october: ClosedMonth = { month: '2026-10-01', closed_count: 10, total_cents: 266360 }
const may: ClosedMonth = { month: '2026-05-01', closed_count: 1, total_cents: 3850 }

describe('the months on Closed tickets', () => {
  it('names a month, with the year only when it is not this one', () => {
    expect(monthKey(now)).toBe('2026-11-01')
    expect(monthName('2026-10-01', now)).toBe('October')
    expect(monthName('2025-12-01', now)).toBe('December 2025')
  })

  it('runs from the first of the month to the first of the next, across a new year', () => {
    expect(monthRange('2026-12-01')).toEqual({
      from: new Date(2026, 11, 1).toISOString(),
      to: new Date(2027, 0, 1).toISOString(),
    })
  })

  it('always starts with this month, then offers the next one back', () => {
    const none = shownMonths([october, may], 0, now)
    expect(none.shown).toEqual([{ month: '2026-11-01', closed_count: 0, total_cents: 0 }])
    expect(none.next).toEqual(october)

    // The empty month makes way for the one asked for.
    const one = shownMonths([october, may], 1, now)
    expect(one.shown).toEqual([october])
    expect(one.next).toEqual(may)

    const two = shownMonths([october, may], 2, now)
    expect(two.shown).toEqual([october, may])
    expect(two.next).toBeNull()
  })

  it('keeps this month above earlier ones when it has tickets', () => {
    const november = { month: '2026-11-01', closed_count: 2, total_cents: 500 }
    expect(shownMonths([november, october], 0, now).shown).toEqual([november])
    expect(shownMonths([november, october], 1, now).shown).toEqual([november, october])
  })

  it('shows no total on an empty month to someone without see_costs', () => {
    const hidden = { ...october, total_cents: null }
    expect(shownMonths([hidden], 0, now).shown[0]!.total_cents).toBeNull()
    expect(shownMonths([], 0, now).shown[0]!.total_cents).toBeNull()
  })

  it('puts a reopened ticket first, then the newest', () => {
    const row = (status: string, last_closed_at: string) => ({ status, last_closed_at })
    const rows = [row('closed', '2026-10-15'), row('reopened', '2026-10-14'), row('closed', '2026-10-17')]
    expect(rows.sort(byReopenedThenNewest).map((r) => r.last_closed_at)).toEqual([
      '2026-10-14',
      '2026-10-17',
      '2026-10-15',
    ])
  })
})
