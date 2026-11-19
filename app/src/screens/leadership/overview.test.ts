import { describe, expect, it } from 'vitest'
import { addMonths, closeTime, monthBounds, overviewFor, type MonthRow } from './overview'

const R = [
  { id: 'logan', name: 'Federale’s Logan Square', color: '#a3336d' },
  { id: 'porter', name: 'Porter', color: '#8a6a00' },
  { id: 'ranallis', name: 'Ranalli’s Logan Square', color: '#1f4f9e' },
]
const row = (restaurant_id: string, month: string, m: Partial<MonthRow> = {}): MonthRow => ({
  restaurant_id,
  month,
  opened: 0,
  closed: 0,
  close_seconds: 0,
  spend_cents: 0,
  visits: 0,
  sees_costs: true,
  ...m,
})
const OPEN = [
  { restaurant_id: 'logan', open_count: 4, urgent_count: 1 },
  { restaurant_id: 'porter', open_count: 4, urgent_count: 2 },
  { restaurant_id: 'ranallis', open_count: 2, urgent_count: 0 },
]
const DAY = 86400

describe('the month on the Overview', () => {
  const months = [
    row('logan', '2026-10-01', { opened: 3, closed: 2, close_seconds: 4 * DAY, spend_cents: 102000, visits: 2 }),
    row('porter', '2026-10-01', { opened: 2, closed: 1, close_seconds: 1 * DAY, spend_cents: 49860, visits: 1 }),
    row('logan', '2026-09-01', { opened: 1, spend_cents: 5000, visits: 1 }),
  ]
  const o = overviewFor(months, OPEN, R, '2026-10-01')

  it('adds up the restaurants in scope', () => {
    expect(o.open).toBe(10)
    expect(o.urgent).toBe(3)
    expect(o.spendCents).toBe(151860)
    expect(o.quiet).toBe(false)
  })

  it('averages the time to close over every ticket closed, not over restaurants', () => {
    expect(o.closeSeconds).toBe((5 * DAY) / 3)
  })

  it('lists every restaurant, most spent first, with what is open now', () => {
    expect(o.rows.map((r) => [r.id, r.spendCents, r.open, r.urgent])).toEqual([
      ['logan', 102000, 4, 1],
      ['porter', 49860, 4, 2],
      ['ranallis', 0, 2, 0],
    ])
  })

  it('leaves out restaurants out of scope', () => {
    expect(overviewFor(months, OPEN, R.slice(1), '2026-10-01').open).toBe(6)
  })

  it('is quiet with nothing opened, closed or spent, while open tickets still count', () => {
    const quiet = overviewFor(months, OPEN, R, '2026-08-01')
    expect(quiet.quiet).toBe(true)
    expect(quiet.spendCents).toBe(0)
    expect(quiet.closeSeconds).toBeNull()
    expect(quiet.open).toBe(10)
  })

  it('has no spend to show where the reader may see none', () => {
    const hidden = months.map((m) => ({ ...m, sees_costs: false, spend_cents: 0 }))
    expect(overviewFor(hidden, OPEN, R, '2026-10-01').spendCents).toBeNull()
  })
})

describe('time to close', () => {
  it('reads in days, hours or under an hour', () => {
    expect(closeTime(null)).toBe('No data')
    expect(closeTime(2.6 * DAY)).toBe('2.6 days')
    expect(closeTime(DAY)).toBe('1 day')
    expect(closeTime(5 * 3600 + 600)).toBe('5 hours')
    expect(closeTime(3600)).toBe('1 hour')
    expect(closeTime(1200)).toBe('Under an hour')
  })
})

describe('the months', () => {
  it('steps across a year', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
  })
  it('reach from the earliest recorded to this month', () => {
    expect(monthBounds([row('logan', '2026-05-01'), row('porter', '2026-09-01')], '2026-11-01')).toEqual({
      earliest: '2026-05-01',
      latest: '2026-11-01',
    })
    expect(monthBounds([], '2026-11-01')).toEqual({ earliest: '2026-11-01', latest: '2026-11-01' })
  })
})
