import { describe, expect, it } from 'vitest'
import {
  filterCount,
  groupByType,
  matchesFilters,
  matchesSearch,
  monthDay,
  monthYear,
  typeNames,
  yearOf,
  type Unit,
} from './equipment'

const unit = (name: string, type: string, area: 'foh' | 'boh', sort: number, extra: Partial<Unit> = {}): Unit => ({
  id: name,
  name,
  brand: null,
  serial: null,
  restaurant_id: 'r1',
  category: { name: type, area, sort_order: sort },
  openCount: 0,
  spendCents: null,
  ...extra,
})

const units = [
  unit('Walk-in Cooler 1', 'Refrigeration', 'boh', 2, { brand: 'Kolpak', serial: 'KP-7XW-220418', openCount: 1 }),
  unit('Ice Machine', 'Refrigeration', 'boh', 2, { brand: 'Hoshizaki', openCount: 2 }),
  unit('Combi Oven', 'Cooking', 'boh', 1),
  unit('Bar sink 2', 'Plumbing', 'foh', 2),
  unit('Floor Drain Pump', 'Plumbing', 'boh', 3),
  unit('Patio string lights', 'Lighting', 'foh', 1),
]

describe('equipment lists', () => {
  it('finds a unit by name, brand or serial, ignoring case and dashes', () => {
    expect(matchesSearch(units[0]!, 'walk-in')).toBe(true)
    expect(matchesSearch(units[0]!, 'kolpak')).toBe(true)
    expect(matchesSearch(units[0]!, 'kp7xw')).toBe(true)
    expect(matchesSearch(units[0]!, 'freezer')).toBe(false)
    expect(matchesSearch(units[3]!, '')).toBe(true)
  })

  it('lists Back of House types first, each name once', () => {
    expect(typeNames(units)).toEqual(['Cooking', 'Refrigeration', 'Plumbing', 'Lighting'])
  })

  it('groups a name across both areas, units by name, with open tickets added up', () => {
    const groups = groupByType(units)
    expect(groups.map((g) => [g.name, g.units.map((u) => u.name), g.openCount])).toEqual([
      ['Cooking', ['Combi Oven'], 0],
      ['Refrigeration', ['Ice Machine', 'Walk-in Cooler 1'], 3],
      ['Plumbing', ['Bar sink 2', 'Floor Drain Pump'], 0],
      ['Lighting', ['Patio string lights'], 0],
    ])
  })

  it('narrows by area and by type, and counts what is on', () => {
    const f = { area: 'boh' as const, types: ['Plumbing'] }
    expect(units.filter((u) => matchesFilters(u, f)).map((u) => u.name)).toEqual(['Floor Drain Pump'])
    expect(filterCount(f)).toBe(2)
    expect(units.filter((u) => matchesFilters(u, { area: null, types: [] }))).toHaveLength(6)
  })
})

describe('equipment dates', () => {
  it('reads a date column as a local day', () => {
    expect(monthYear('2022-03-14')).toBe('Mar 2022')
    expect(monthDay('2026-01-01')).toBe('Jan 1')
    expect(yearOf('2026-01-01')).toBe(2026)
  })
})
