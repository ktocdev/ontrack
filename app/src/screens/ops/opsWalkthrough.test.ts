import { describe, expect, it } from 'vitest'
import { lastReminderLabel, pastLine, reminderFor } from './opsWalkthrough'

describe('the last reminder', () => {
  const now = new Date(2026, 9, 21, 16, 0)

  it('says none went', () => {
    expect(lastReminderLabel(null, now)).toBe('None sent yet')
  })

  it('gives the time when it went today, and the day otherwise', () => {
    expect(lastReminderLabel(new Date(2026, 9, 21, 15, 10).toISOString(), now)).toBe('today at 3:10 PM')
    expect(lastReminderLabel(new Date(2026, 9, 15, 9, 0).toISOString(), now)).toBe('Oct 15')
  })
})

describe('a past month', () => {
  const submitted = new Date(2026, 8, 28, 17, 30).toISOString()

  it('says when it went in and what it flagged', () => {
    expect(pastLine({ standing: 'on_time', submitted_at: submitted, tickets: 5, fixes: 1 })).toBe('Sep 28 · 5 tickets')
    expect(pastLine({ standing: 'late', submitted_at: submitted, tickets: 1, fixes: 0 })).toBe('Sep 28 · 1 ticket')
    expect(pastLine({ standing: 'on_time', submitted_at: submitted, tickets: 0, fixes: 2 })).toBe('Sep 28 · 2 in-house')
    expect(pastLine({ standing: 'on_time', submitted_at: submitted, tickets: 0, fixes: 0 })).toBe('Sep 28 · all good')
  })

  it('says one never submitted was not done', () => {
    expect(pastLine({ standing: 'missed', submitted_at: null, tickets: 2, fixes: 0 })).toBe('Not done')
  })
})

describe('Send reminder', () => {
  it('names whoever started it, else the manager, else nobody', () => {
    expect(reminderFor('Maya Reyes', 'Ari Kim')).toBe('Maya')
    expect(reminderFor(null, 'Ari Kim')).toBe('Ari')
    expect(reminderFor(null, null)).toBeNull()
  })
})
