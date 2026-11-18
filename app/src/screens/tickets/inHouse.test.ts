import { describe, expect, it } from 'vitest'
import { addedBy, handedBackFrom, splitClosed } from './inHouse'

const now = new Date('2026-11-06T12:00:00Z')
const task = (title: string, done_at: string | null) => ({ title, done_at })

describe('closed in-house tasks', () => {
  it('shows the last 30 days, latest first, and keeps the rest behind Show older', () => {
    const { recent, older } = splitClosed(
      [
        task('open', null),
        task('a month and a day', '2026-10-06T11:00:00Z'),
        task('yesterday', '2026-11-05T12:00:00Z'),
        task('exactly 30 days', '2026-10-07T12:00:00Z'),
        task('last spring', '2026-04-01T12:00:00Z'),
        task('today', '2026-11-06T09:00:00Z'),
      ],
      now,
    )
    expect(recent.map((t) => t.title)).toEqual(['today', 'yesterday', 'exactly 30 days'])
    expect(older.map((t) => t.title)).toEqual(['a month and a day', 'last spring'])
  })

  it('has nothing to split when nothing is checked off', () => {
    expect(splitClosed([task('open', null)], now)).toEqual({ recent: [], older: [] })
  })
})

describe('where a task came from', () => {
  const at = '2026-11-18T15:00:00'
  it('names the Support Team sender, the day and the unit', () => {
    expect(
      addedBy({ created_at: at, from_ops: true, adder: { full_name: 'Bert Velilla' }, unit: { name: 'Bar sink' } }),
    ).toBe('From Bert · Nov 18 · Bar sink')
  })
  it('says who added one by hand', () => {
    expect(addedBy({ created_at: at, from_ops: false, adder: { full_name: 'Maya Reyes' }, unit: null })).toBe(
      'Added by Maya · Nov 18',
    )
  })
  it('links a handed-back task to its ticket, for each role', () => {
    const t = { from_ticket: { id: 'abc', display_id: 'OT-1042' } }
    expect(handedBackFrom(t, 'manager')).toEqual({ label: 'Handed back from OT-1042', to: '/tickets/abc' })
    expect(handedBackFrom(t, 'ops')).toEqual({ label: 'Handed back from OT-1042', to: '/ops/tickets/abc' })
    expect(handedBackFrom({ from_ticket: null }, 'manager')).toBeUndefined()
  })
})
