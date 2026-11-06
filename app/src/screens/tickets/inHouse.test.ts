import { describe, expect, it } from 'vitest'
import { splitClosed } from './inHouse'

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
