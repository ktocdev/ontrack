import { describe, expect, it } from 'vitest'
import {
  insuranceWarning,
  matchesSearch,
  sortRows,
  summarize,
  tradeChips,
  tradeCount,
  wholeDollars,
  type Contractor,
  type SpendRow,
} from './contractors'

const NOW = new Date(2026, 9, 20) // Oct 20, 2026
const c = (id: string, over: Partial<Contractor> = {}): Contractor => ({
  id,
  name: id,
  trade: 'Refrigeration',
  contact_name: null,
  phone: null,
  preferred: false,
  insurance_until: null,
  ...over,
})
const s = (
  contractor: string,
  restaurant: string,
  year: number,
  cents: number,
  visits: number,
  last: string,
): SpendRow => ({
  contractor_id: contractor,
  restaurant_id: restaurant,
  year,
  total_cents: cents,
  visits,
  last_visit_on: last,
})

describe('insuranceWarning', () => {
  it('warns 30 days out or less, and once it has run out', () => {
    expect(insuranceWarning('2026-11-01', NOW)).toBe('Insurance expires Nov 1')
    expect(insuranceWarning('2026-11-19', NOW)).toBe('Insurance expires Nov 19')
    expect(insuranceWarning('2026-11-20', NOW)).toBeNull()
    expect(insuranceWarning('2026-09-30', NOW)).toBe('Insurance expired Sep 30')
    expect(insuranceWarning('2025-12-31', NOW)).toBe('Insurance expired Dec 31, 2025')
    expect(insuranceWarning(null, NOW)).toBeNull()
  })
})

describe('summarize', () => {
  const spend = [
    s('a', 'r1', 2026, 40000, 2, '2026-10-19'),
    s('a', 'r2', 2026, 10000, 1, '2026-09-01'),
    s('a', 'r1', 2025, 99900, 5, '2025-12-01'),
    s('b', 'r2', 2025, 5000, 1, '2025-03-04'),
  ]
  it('adds this year at the restaurants picked, and keeps the last visit ever', () => {
    const [a, b] = summarize([c('a'), c('b')], spend, ['r1', 'r2'], 2026, NOW)
    expect(a).toMatchObject({ yearCents: 50000, yearVisits: 3, lastVisit: '2026-10-19' })
    expect(b).toMatchObject({ yearCents: 0, yearVisits: 0, lastVisit: '2025-03-04' })
  })
  it('follows the restaurant picker', () => {
    const [a, b] = summarize([c('a'), c('b')], spend, ['r2'], 2026, NOW)
    expect(a).toMatchObject({ yearCents: 10000, yearVisits: 1, lastVisit: '2026-09-01' })
    expect(b).toMatchObject({ lastVisit: '2025-03-04' })
  })
})

describe('search and sort', () => {
  it('finds a company, contact or trade', () => {
    const k = c('Coldline Refrigeration', { contact_name: 'Rosa Alvarez' })
    expect(matchesSearch(k, 'rosa')).toBe(true)
    expect(matchesSearch(k, 'REFRIG')).toBe(true)
    expect(matchesSearch(k, 'roofing')).toBe(false)
    expect(matchesSearch(k, '  ')).toBe(true)
  })
  it('puts the most used first, or the most spent', () => {
    const rows = summarize(
      [c('few', { preferred: true }), c('many'), c('none')],
      [s('few', 'r', 2026, 90000, 1, '2026-10-01'), s('many', 'r', 2026, 10000, 5, '2026-09-01')],
      ['r'],
      2026,
      NOW,
    )
    expect(sortRows(rows, 'used').map((r) => r.id)).toEqual(['many', 'few', 'none'])
    expect(sortRows(rows, 'spend').map((r) => r.id)).toEqual(['few', 'many', 'none'])
  })
})

describe('chips and labels', () => {
  it('lists trades with the most contractors first', () => {
    expect(tradeChips([c('a'), c('b', { trade: 'HVAC' }), c('c'), c('d', { trade: 'Electrical' })])).toEqual([
      'Refrigeration',
      'Electrical',
      'HVAC',
    ])
  })
  it('writes spend in whole dollars and counts a trade', () => {
    expect(wholeDollars(481240)).toBe('$4,812')
    expect(tradeCount(1, 'HVAC')).toBe('1 HVAC contractor')
    expect(tradeCount(3, 'Refrigeration')).toBe('3 refrigeration contractors')
  })
})
