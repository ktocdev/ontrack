import { describe, expect, it } from 'vitest'
import { money, reopenDaysLeft, reopenStory, timeline, timeToClose } from './closed'
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

  describe('reopened', () => {
    const bert = { id: 'bert', full_name: 'Bert Velilla', role: 'ops' as const, avatar_path: null }
    const maya = { id: 'maya', full_name: 'Maya Reyes', role: 'manager' as const, avatar_path: null }
    const at = (day: number) => `2026-10-${day}T12:00:00.000Z`
    const u = (id: string, kind: Update['kind'], rest: Partial<Update>): Update => ({
      id,
      kind,
      body: null,
      meta: {},
      created_at: at(1),
      author: bert,
      ...rest,
    })

    it('finds the reason in the message posted with the reopen, on either side of it', () => {
      const closed = u('c', 'closed', { body: 'Replaced it.', created_at: at(14) })
      const reopen = u('r', 'reopened', { author: maya, created_at: at(23) })
      const reason = u('m', 'message', { author: maya, body: 'Torn again.', created_at: at(23) })
      for (const order of [
        [closed, reopen, reason],
        [closed, reason, reopen],
      ]) {
        expect(reopenStory(order)).toMatchObject({
          reason: 'Torn again.',
          reasonUpdateId: 'm',
          reopenedBy: 'Maya Reyes',
          closingComment: 'Replaced it.',
          closer: bert,
          daysAfterClosing: 9,
        })
      }
    })

    it('takes the words on the event itself, and the latest reopen and close', () => {
      const story = reopenStory([
        u('c1', 'closed', { body: 'First fix.', created_at: at(2) }),
        u('r1', 'reopened', { author: maya, body: 'Old reason.', created_at: at(3) }),
        u('c2', 'closed', { body: 'Second fix.', created_at: at(4) }),
        u('m', 'message', { author: maya, body: 'A chat about something else.', created_at: at(5) }),
        u('r2', 'reopened', { author: maya, body: 'New reason.', created_at: at(6) }),
      ])
      expect(story).toMatchObject({ reason: 'New reason.', reasonUpdateId: 'r2', closingComment: 'Second fix.' })
    })

    it('has nothing to say about a ticket never reopened', () => {
      expect(reopenStory([u('1', 'created', {})])).toMatchObject({ reason: null, daysAfterClosing: null })
    })
  })
})
