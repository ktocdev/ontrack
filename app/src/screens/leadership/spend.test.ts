import { describe, expect, it } from 'vitest'
import { categoryOf, IN_HOUSE, NO_CATEGORY, spendFor, visitCount, workerOf, type SpendVisit } from './spend'

const LOGAN = { id: 'r1', name: 'Logan Square', color: 'var(--a)' }
const PORTER = { id: 'r2', name: 'Porter', color: 'var(--b)' }
const RANALLI = { id: 'r3', name: "Ranalli's", color: 'var(--c)' }

const COLDLINE = { id: 'c1', name: 'Coldline' }
const HOODPRO = { id: 'c2', name: 'HoodPro' }

const visit = (over: Partial<SpendVisit> & Pick<SpendVisit, 'id'>): SpendVisit => ({
  service_date: '2026-10-10',
  title: 'Work',
  kind: 'contractor',
  restaurant_id: LOGAN.id,
  restaurant: { name: LOGAN.name, color: LOGAN.color },
  contractor: COLDLINE,
  equipment: { name: 'Walk-in Cooler 1', category: { name: 'Refrigeration' } },
  ticket: null,
  totalCents: 10000,
  invoiceMissing: false,
  ...over,
})

const ALL: SpendVisit[] = [
  visit({ id: 'a', service_date: '2026-10-19', totalCents: 39740 }),
  visit({ id: 'b', service_date: '2026-10-11', contractor: HOODPRO, restaurant_id: PORTER.id, totalCents: 18660 }),
  visit({
    id: 'c',
    service_date: '2026-10-07',
    kind: 'in_house',
    contractor: null,
    equipment: null,
    ticket: { display_id: 'OT-1020', category: { name: 'Lighting' } },
    totalCents: 1200,
  }),
  visit({ id: 'd', service_date: '2026-10-14', totalCents: 24500, invoiceMissing: true }),
  // Another month, and a restaurant out of scope.
  visit({ id: 'e', service_date: '2026-09-30', totalCents: 99999 }),
  visit({ id: 'f', restaurant_id: 'elsewhere', totalCents: 88888 }),
]

describe('spendFor', () => {
  const view = spendFor(ALL, [LOGAN, PORTER, RANALLI], '2026-10-01')

  it('takes the month’s visits at the restaurants in scope, newest first', () => {
    expect(view.visits.map((v) => v.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('adds up to the total, split by kind', () => {
    expect(view.totalCents).toBe(39740 + 24500 + 18660 + 1200)
    expect(view.contractorCents).toBe(39740 + 24500 + 18660)
    expect(view.inHouseCents).toBe(1200)
    expect(view.contractorCents + view.inHouseCents).toBe(view.totalCents)
  })

  it('counts contractor visits with no invoice', () => {
    expect(view.missing).toBe(1)
  })

  it('lists every restaurant in scope, the most spent first, those with none last', () => {
    expect(view.byRestaurant.map((r) => [r.name, r.cents, r.visits])).toEqual([
      ['Logan Square', 39740 + 24500 + 1200, 3],
      ['Porter', 18660, 1],
      ["Ranalli's", 0, 0],
    ])
  })

  it('adds up each contractor, and in-house work as one line', () => {
    expect(view.byContractor.map((c) => [c.name, c.cents, c.visits, c.contractorId])).toEqual([
      ['Coldline', 64240, 2, 'c1'],
      ['HoodPro', 18660, 1, 'c2'],
      [IN_HOUSE, 1200, 1, null],
    ])
  })

  it('adds up each category, and every breakdown sums to the total', () => {
    expect(view.byCategory.map((c) => [c.name, c.cents])).toEqual([
      ['Refrigeration', 39740 + 24500 + 18660],
      ['Lighting', 1200],
    ])
    for (const lines of [view.byRestaurant, view.byContractor, view.byCategory])
      expect(lines.reduce((n, l) => n + l.cents, 0)).toBe(view.totalCents)
  })

  it('is empty for a month with nothing', () => {
    const quiet = spendFor(ALL, [LOGAN], '2026-08-01')
    expect(quiet.totalCents).toBe(0)
    expect(quiet.visits).toEqual([])
    expect(quiet.byRestaurant).toEqual([{ ...LOGAN, cents: 0, visits: 0 }])
  })
})

describe('categoryOf and workerOf', () => {
  it('reads the unit’s category, then the ticket’s, then none', () => {
    expect(categoryOf(visit({ id: 'x' }))).toBe('Refrigeration')
    expect(
      categoryOf(visit({ id: 'x', equipment: null, ticket: { display_id: null, category: { name: 'Plumbing' } } })),
    ).toBe('Plumbing')
    expect(categoryOf(visit({ id: 'x', equipment: null }))).toBe(NO_CATEGORY)
  })

  it('names the contractor, or In-house', () => {
    expect(workerOf(visit({ id: 'x' }))).toBe('Coldline')
    expect(workerOf(visit({ id: 'x', kind: 'in_house', contractor: null }))).toBe(IN_HOUSE)
  })

  it('counts visits', () => {
    expect(visitCount(1)).toBe('1 visit')
    expect(visitCount(3)).toBe('3 visits')
  })
})
