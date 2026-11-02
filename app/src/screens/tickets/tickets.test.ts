import { describe, expect, it } from 'vitest'
import { activityLine, ago, byActivity, matchesSearch, scheduledLabel } from './tickets'

const now = new Date('2026-10-29T12:00:00')
const before = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN

describe('ticket times', () => {
  it('says how long ago', () => {
    expect(ago(new Date(now.getTime() - 20_000), now)).toBe('just now')
    expect(ago(new Date(now.getTime() - 25 * MIN), now)).toBe('25m ago')
    expect(ago(new Date(now.getTime() - 3 * HOUR), now)).toBe('3h ago')
    expect(ago(new Date(now.getTime() - 26 * HOUR), now)).toBe('yesterday')
    expect(ago(new Date(now.getTime() - 50 * HOUR), now)).toBe('2d ago')
  })

  it('names what last happened', () => {
    const base = { status: 'open', reopened_at: null } as const
    expect(activityLine({ ...base, created_at: before(3 * HOUR), updated_at: before(3 * HOUR) }, now)).toBe(
      'Created 3h ago',
    )
    expect(activityLine({ ...base, created_at: before(9 * HOUR), updated_at: before(HOUR) }, now)).toBe(
      'Updated 1h ago',
    )
    expect(
      activityLine(
        { status: 'reopened', created_at: before(99 * HOUR), updated_at: before(HOUR), reopened_at: before(2 * HOUR) },
        now,
      ),
    ).toBe('Reopened 2h ago')
  })

  it('names a scheduled day this week, and dates any other', () => {
    expect(scheduledLabel('2026-10-29', now)).toBe('Scheduled Thu')
    expect(scheduledLabel('2026-11-04', now)).toBe('Scheduled Wed')
    expect(scheduledLabel('2026-11-05', now)).toBe('Scheduled Nov 5')
    expect(scheduledLabel('2026-10-28', now)).toBe('Scheduled Oct 28')
  })
})

describe('finding tickets', () => {
  it('puts the most recent first, reopened or not', () => {
    const t = (hours: number) => ({ updated_at: before(hours * HOUR) })
    const [recent, middle, older] = [t(1), t(2), t(5)]
    expect([older, recent, middle].sort(byActivity)).toEqual([recent, middle, older])
  })

  it('searches any field, ignoring case and empty values', () => {
    expect(matchesSearch('COOLER', ['Door gasket', null, 'Walk-in Cooler 1'])).toBe(true)
    expect(matchesSearch('1042', ['OT-1042'])).toBe(true)
    expect(matchesSearch('freezer', ['Door gasket', null])).toBe(false)
    expect(matchesSearch('   ', ['Door gasket'])).toBe(true)
  })
})
