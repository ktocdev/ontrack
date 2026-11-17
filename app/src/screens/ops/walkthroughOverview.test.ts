import { describe, expect, it } from 'vitest'
import {
  historyLabel,
  lastSixMonths,
  monthLine,
  monthRows,
  monthsOf,
  summaryLine,
  type SummaryRow,
} from './walkthroughOverview'

const row = (restaurant: string, over: Partial<SummaryRow> = {}): SummaryRow => ({
  walkthrough_id: `w-${restaurant}`,
  restaurant_id: restaurant,
  period: '2026-10-01',
  due_on: '2026-10-31',
  standing: 'in_progress',
  template_name: 'Back of House + Front of House',
  template_short_name: 'BOH + FOH',
  template_description: 'Full walkthrough',
  total: 50,
  done: 10,
  tickets: 0,
  fixes: 0,
  submitted_at: null,
  ...over,
})
const restaurant = (id: string) => ({ id, name: id, color: '#000000' })

describe('the months', () => {
  it('are each month once, newest first', () => {
    expect(monthsOf(['2026-09-01', '2026-10-01', '2026-09-01'])).toEqual(['2026-10-01', '2026-09-01'])
  })

  it('in the history are the six ending with the one shown, across a new year', () => {
    expect(lastSixMonths('2026-10-01')).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ])
    expect(lastSixMonths('2027-02-01')[0]).toBe('2026-09-01')
  })
})

describe('the month’s rows', () => {
  it('put what needs looking at first: not submitted, least done, then submitted', () => {
    const rows = [
      row('ranallis', { standing: 'on_time', done: 50, submitted_at: '2026-10-18T22:00:00Z' }),
      row('logan', { done: 20 }),
      row('porter', { standing: 'not_started', done: 0 }),
      row('westloop', { done: 6 }),
    ]
    const order = monthRows(rows, '2026-10-01', ['logan', 'westloop', 'porter', 'ranallis'].map(restaurant))
    expect(order.map((x) => x.restaurant.id)).toEqual(['porter', 'westloop', 'logan', 'ranallis'])
  })

  it('leave out a restaurant with no walkthrough that month', () => {
    expect(monthRows([row('logan')], '2026-10-01', [restaurant('logan'), restaurant('new')])).toHaveLength(1)
  })
})

describe('the lines', () => {
  it('name the checklist and due date the restaurants share', () => {
    expect(monthLine([row('a'), row('b')])).toBe('Full walkthrough · BOH + FOH · due Oct 31')
  })

  it('count the checklists when they differ, and leave out a due date that differs', () => {
    expect(monthLine([row('a'), row('b', { template_short_name: 'Kitchen + Bar', due_on: '2026-10-10' })])).toBe(
      '2 checklists',
    )
  })

  it('say how many are submitted and how long is left', () => {
    const rows = [row('a', { standing: 'on_time' }), row('b'), row('c'), row('d')]
    expect(summaryLine(rows, '2026-10-21')).toEqual({ count: '1 of 4', left: '10 days left' })
    expect(summaryLine(rows, '2026-10-30').left).toBe('1 day left')
    expect(summaryLine(rows, '2026-10-31').left).toBe('Due today')
    expect(summaryLine(rows, '2026-11-02').left).toBeNull()
  })

  it('say nothing is left once every one is in', () => {
    expect(summaryLine([row('a', { standing: 'late' })], '2026-10-21')).toEqual({ count: '1 of 1', left: null })
  })

  it('read a square out with its month', () => {
    expect(historyLabel('Porter', '2026-07-01', 'late')).toBe('Porter, July: Late')
    expect(historyLabel('Porter', '2026-07-01', undefined)).toBe('Porter, July: No walkthrough')
  })
})
