import { describe, expect, it } from 'vitest'
import type { SummaryRow } from '../ops/walkthroughOverview'
import { leadRows, onTimeShare, percentDone, record, rowLine, submittedCount } from './walkthroughs'

const row = (restaurant: string, period: string, standing: SummaryRow['standing'], more: Partial<SummaryRow> = {}) =>
  ({
    walkthrough_id: `${restaurant}-${period}`,
    restaurant_id: restaurant,
    period,
    due_on: `${period.slice(0, 7)}-28`,
    standing,
    template_name: 'Full walkthrough',
    template_short_name: null,
    template_description: null,
    total: 50,
    done: standing === 'on_time' || standing === 'late' ? 50 : 0,
    tickets: 0,
    fixes: 0,
    submitted_at: null,
    ...more,
  }) satisfies SummaryRow

const OCT = '2026-10-01'
const past = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01']
const restaurants = ['ranallis', 'logan', 'west', 'porter'].map((id) => ({ id, name: id, color: '#000' }))

// The board's month: Ranalli's on time every month, Logan Square 3 of 5, West Loop 4 of 5,
// Porter none of 5 with 2 missed.
const history = [
  ...past.map((p) => row('ranallis', p, 'on_time')),
  row('ranallis', OCT, 'on_time', { tickets: 2, fixes: 3 }),
  ...past.map((p, i) => row('logan', p, i < 3 ? 'on_time' : 'late')),
  row('logan', OCT, 'in_progress', { done: 20, tickets: 1 }),
  ...past.map((p, i) => row('west', p, i < 4 ? 'on_time' : 'late')),
  row('west', OCT, 'in_progress', { done: 6 }),
  ...past.map((p, i) => row('porter', p, i < 2 ? 'missed' : 'late')),
  row('porter', OCT, 'not_started'),
  // Before the six months: never counted.
  row('porter', '2026-04-01', 'on_time'),
]

describe('leadership walkthroughs', () => {
  it('counts on time over the finished months of the last six', () => {
    expect(record(history, OCT)).toEqual({ onTime: 13, finished: 21, missed: 2 })
    expect(onTimeShare(history, OCT)).toBe('62%')
    expect(onTimeShare([row('logan', OCT, 'in_progress')], OCT)).toBe('—')
  })

  it('orders submitted first, then most done', () => {
    const rows = leadRows(history, OCT, restaurants)
    expect(rows.map((r) => r.restaurant.id)).toEqual(['ranallis', 'logan', 'west', 'porter'])
    expect(submittedCount(rows.map((r) => r.row))).toBe('1 of 4')
    expect(percentDone(rows[1]!.row)).toBe('40%')
    expect(percentDone(rows[2]!.row)).toBe('12%')
  })

  it('reads each row as the board does', () => {
    const line = (id: string) =>
      rowLine(
        history.find((r) => r.restaurant_id === id && r.period === OCT)!,
        history,
        OCT,
      )
    expect(line('ranallis')).toBe('2 tickets · on time 6 of 6 months')
    expect(line('logan')).toBe('1 ticket so far · on time 3 of 5 months')
    expect(line('west')).toBe('No issues so far · on time 4 of 5 months')
    expect(line('porter')).toBe('On time 0 of 5 months · 2 missed')
  })

  it('says nothing is still coming once a month is missed', () => {
    const missed = row('logan', OCT, 'missed', { done: 12, tickets: 1 })
    expect(rowLine(missed, [missed], OCT)).toBe('1 ticket · on time 0 of 1 month · 1 missed')
    const empty = row('porter', OCT, 'missed')
    expect(rowLine(empty, [empty], OCT)).toBe('On time 0 of 1 month · 1 missed')
  })

  it('says no tickets, not no issues, when only in-house fixes were flagged', () => {
    const r = row('logan', OCT, 'in_progress', { done: 10, fixes: 2 })
    expect(rowLine(r, [r], OCT)).toBe('No tickets so far')
  })
})
