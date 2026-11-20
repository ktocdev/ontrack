import { describe, expect, it } from 'vitest'
import {
  areaOf,
  equipmentPayload,
  equipmentReviewFirst,
  equipmentReviewSecond,
  type Category,
  type EquipmentField,
} from './equipmentImport'
import { applyFixes, counts, rowStates, type Resolutions } from './review'

const RESTAURANTS = [
  { id: 'ls', name: 'Federale’s Logan Square' },
  { id: 'wl', name: 'Federale’s West Loop' },
  { id: 'po', name: 'Porter' },
]
const CATEGORIES: Category[] = [
  { id: 'ref', name: 'Refrigeration', area: 'boh', active: true },
  { id: 'cook', name: 'Cooking', area: 'boh', active: true },
  { id: 'fry', name: 'Fryers', area: 'boh', active: false },
  { id: 'light', name: 'Lighting', area: 'foh', active: true },
]
const UNITS = [
  { id: 'u1', name: 'Walk-in Cooler 1', serial: 'KP-7XW-220418', restaurant_id: 'ls', retired_at: null },
  { id: 'u2', name: 'Ice Machine', serial: null, restaurant_id: 'po', retired_at: null },
]

const rec = (row: number, v: Partial<Record<EquipmentField, string>>) => ({
  row,
  values: {
    name: '',
    restaurant: '',
    area: '',
    category: '',
    brand: '',
    model: '',
    serial: '',
    installed: '',
    warranty: '',
    ...v,
  },
})

// The board's sheet, in small: "Federales LS" on two rows, a missing area, the walk-in again by serial.
const records = [
  rec(2, {
    name: 'Cooler (walk-in)',
    restaurant: 'Federales LS',
    area: 'BOH',
    category: 'Refrigeration',
    serial: 'kp-7xw-220418',
  }),
  rec(3, { name: 'Combi Oven', restaurant: 'Federales LS', area: 'BOH', category: 'Cooking', installed: '3/2022' }),
  rec(4, { name: 'Ice Machine 2', restaurant: 'Porter', area: '', category: 'Refrigeration' }),
  rec(5, {
    name: 'Host stand pendant',
    restaurant: 'Federale’s West Loop',
    area: 'Front',
    category: 'Lights',
    warranty: 'Parts through 2027',
  }),
  rec(6, { name: 'Fryer', restaurant: 'Porter', area: 'Kitchen', category: 'Fryers', warranty: 'Jun 2028' }),
]
const mapped = new Set<EquipmentField>(['name', 'restaurant', 'area', 'category', 'serial', 'installed', 'warranty'])

function review(resolutions: Resolutions) {
  const rows = records.map((r) => r.row)
  const first = equipmentReviewFirst(records, RESTAURANTS, false)
  const firstStates = rowStates(rows, first, resolutions, new Set())
  const settled = new Set(rows.filter((n) => firstStates.get(n) === 'ready'))
  const second = equipmentReviewSecond(
    applyFixes(records, first, resolutions),
    settled,
    RESTAURANTS,
    null,
    CATEGORIES,
    UNITS,
  )
  const issues = [...first, ...second.issues]
  const states = rowStates(rows, issues, resolutions, new Set(second.duplicates.keys()))
  return { first, second, issues, states, fixed: applyFixes(records, issues, resolutions) }
}

describe('the review of an equipment sheet', () => {
  it('reads an area by the words a sheet uses', () => {
    expect(['BOH', 'Back of house', 'kitchen', 'FOH', 'Front', 'IT'].map(areaOf)).toEqual([
      'boh',
      'boh',
      'boh',
      'foh',
      'foh',
      'it',
    ])
  })

  it('first asks about the restaurant and the area, as the board does', () => {
    const { first } = review({})
    const byId = Object.fromEntries(first.map((i) => [i.id, i]))
    expect(byId['restaurant:federales ls']).toMatchObject({
      title: '“Federales LS” isn’t a restaurant name',
      who: '2 rows · pick the restaurant it means',
      initial: 'Federale’s Logan Square',
    })
    expect(byId['area:4']).toMatchObject({ title: 'Area is missing', who: 'Ice Machine 2 · row 4' })
  })

  it('then the category in its area, a turned-off one, and the walk-in by its serial', () => {
    const { second } = review({
      'restaurant:federales ls': { status: 'fixed', value: 'Federale’s Logan Square' },
      'area:4': { status: 'fixed', value: 'Back of House' },
    })
    const byId = Object.fromEntries(second.issues.map((i) => [i.id, i]))
    expect(byId['category:foh:lights']).toMatchObject({
      title: '“Lights” isn’t a Front of House category',
      initial: 'Lighting',
    })
    expect(byId['category:boh:fryers']?.title).toBe('“Fryers” is turned off')
    expect(second.duplicates.get(2)).toEqual({
      title: 'Walk-in Cooler 1',
      sub: 'Row 2 · serial KP-7XW-220418 is already in OnTrack',
    })
  })

  it('sends what is ready with its ids, a warranty as a date or a note, and the one to update', () => {
    const resolutions: Resolutions = {
      'restaurant:federales ls': { status: 'fixed', value: 'Federale’s Logan Square' },
      'area:4': { status: 'fixed', value: 'Back of House' },
      'category:foh:lights': { status: 'fixed', value: 'Lighting' },
      'category:boh:fryers': { status: 'skipped' },
    }
    const { states, fixed } = review(resolutions)
    expect(counts(states)).toEqual({ ready: 3, fix: 0, duplicate: 1, skipped: 1 })
    const { columns, rows } = equipmentPayload(fixed, states, new Set([2]), mapped, RESTAURANTS, null, CATEGORIES)
    expect(columns).toEqual(['name', 'category_id', 'serial', 'installed_on', 'warranty_until', 'warranty_note'])
    expect(rows.map((r) => [r.row, r.restaurant_id, r.category_id, r.on_duplicate])).toEqual([
      [2, 'ls', 'ref', 'update'],
      [3, 'ls', 'cook', 'skip'],
      [4, 'po', 'ref', 'skip'],
      [5, 'wl', 'light', 'skip'],
    ])
    expect(rows.find((r) => r.row === 3)?.installed_on).toBe('2022-03-01')
    expect(rows.find((r) => r.row === 5)).toMatchObject({ warranty_until: null, warranty_note: 'Parts through 2027' })
  })

  it('with one restaurant for every row, asks nothing about restaurants and sends none per row', () => {
    const one = records.map((r) => ({ ...r, values: { ...r.values, restaurant: '' } }))
    expect(equipmentReviewFirst(one, RESTAURANTS, true).some((i) => i.field === 'restaurant')).toBe(false)
  })
})
