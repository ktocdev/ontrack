import { describe, expect, it } from 'vitest'
import { isVideoUrl } from '../../lib/words'
import { inQuarter, listFor, quarterOfDate, summaryFor, type TaskRow } from './quarterly'

const task = (t: Partial<TaskRow> & { id: string }): TaskRow => ({
  restaurant_id: null,
  overrides_task_id: null,
  title: t.id,
  directions: null,
  video_url: null,
  months: [10],
  removed: false,
  active: true,
  sort_order: 0,
  ...t,
})

const R = 'ranallis'
const rows = [
  task({ id: 'utility', sort_order: 1 }),
  task({ id: 'floors', sort_order: 2 }),
  task({ id: 'gutters', months: [1, 4, 7, 10], sort_order: 3 }),
  task({ id: 'spring', months: [4] }),
  task({ id: 'old', active: false }),
  task({ id: 'v-utility', restaurant_id: R, overrides_task_id: 'utility', title: 'utility and dock' }),
  task({ id: 'v-floors', restaurant_id: R, overrides_task_id: 'floors', removed: true }),
  task({ id: 'flue', restaurant_id: R }),
  task({ id: 'v-gutters', restaurant_id: R, overrides_task_id: 'gutters', active: false }),
]

describe('quarters', () => {
  it('places months and dates in their quarter', () => {
    expect(inQuarter([10], 4)).toBe(true)
    expect(inQuarter([1, 4, 7, 10], 2)).toBe(true)
    expect(inQuarter([4], 1)).toBe(false)
    expect(quarterOfDate(new Date('2026-11-18T12:00:00'))).toBe(4)
  })
})

describe('the group’s list', () => {
  it('lists the active group tasks in the quarter, and what is turned off', () => {
    const l = listFor(rows, null, 4)
    expect(l.tasks.map((t) => t.task.id)).toEqual(['utility', 'floors', 'gutters'])
    expect(l.off.map((t) => t.id)).toEqual(['old'])
  })
})

describe('a restaurant’s list', () => {
  it('shows its version, the group’s where it has none, its own, and what it removed', () => {
    const l = listFor(rows, R, 4)
    expect(l.tasks.map((t) => `${t.kind}:${t.task.id}`)).toEqual(['changed:v-utility', 'inherited:gutters', 'own:flue'])
    expect(l.removed.map((t) => t.id)).toEqual(['floors'])
  })
  it('follows the group where its version is turned off', () => {
    expect(listFor(rows, R, 2).tasks.map((t) => `${t.kind}:${t.task.id}`)).toEqual([
      'inherited:spring',
      'inherited:gutters',
    ])
  })
  it('sums up what it changed', () => {
    expect(summaryFor(rows, R)).toBe('1 added · 1 changed · 1 removed')
    expect(summaryFor(rows, 'porter')).toBe('Uses the all-restaurants list')
  })
})

describe('a how-to link', () => {
  it('is a web address and nothing more', () => {
    expect(isVideoUrl('https://youtube.com/watch?v=x')).toBe(true)
    expect(isVideoUrl('javascript:alert(1)')).toBe(false)
    expect(isVideoUrl('https://a b')).toBe(false)
  })
})
