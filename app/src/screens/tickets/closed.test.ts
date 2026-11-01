import { describe, expect, it } from 'vitest'
import { money, reopenDaysLeft, timeline, timeToClose } from './closed'
import type { Update } from './thread'

const now = new Date('2026-10-23T12:00:00')

describe('a closed ticket', () => {
  it('says how long is left to reopen', () => {
    expect(reopenDaysLeft('2026-10-14T16:05:00', now)).toBe(22)
    expect(reopenDaysLeft('2026-10-23T12:00:00', now)).toBe(30)
    expect(reopenDaysLeft('2026-09-23T13:00:00', now)).toBe(1)
    expect(reopenDaysLeft('2026-09-23T12:00:00', now)).toBe(0)
    expect(reopenDaysLeft('2026-05-03T12:00:00', now)).toBeLessThan(0)
  })

  it('says how long it took', () => {
    expect(timeToClose('2026-10-10T09:12:00', '2026-10-14T16:05:00')).toBe('4 days')
    expect(timeToClose('2026-10-10T09:00:00', '2026-10-11T10:00:00')).toBe('1 day')
    expect(timeToClose('2026-10-10T09:00:00', '2026-10-10T15:00:00')).toBe('Under a day')
  })

  it('writes cents as dollars', () => {
    expect(money(24500)).toBe('$245.00')
    expect(money(266360)).toBe('$2,663.60')
  })

  it('tells its life without the chat, as the board does', () => {
    const author = { id: 'bert', full_name: 'Bert Velilla', role: 'ops' as const, avatar_path: null }
    const u = (id: string, kind: Update['kind'], rest: Partial<Update> = {}): Update => ({
      id,
      kind,
      body: null,
      meta: {},
      created_at: '2026-10-11T14:40:00',
      author,
      ...rest,
    })
    const steps = timeline([
      u('1', 'created'),
      u('2', 'assigned'),
      u('3', 'status_changed', { meta: { to: 'in_progress' }, body: 'Gasket ordered.' }),
      u('4', 'message', { body: 'On the way.' }),
      u('5', 'closed', { body: 'Replaced it.' }),
    ])
    expect(steps.map((s) => [s.title, s.note, s.end])).toEqual([
      ['Opened', null, false],
      ['In progress', 'Gasket ordered.', false],
      ['Closed', null, true],
    ])
    expect(steps[0]!.when).toBe('Bert Velilla · Oct 11, 2026, 2:40 PM')
  })
})
