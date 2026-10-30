import { describe, expect, it } from 'vitest'
import { inviteLine, scopeLine } from './people'

const now = new Date('2026-10-30T12:00:00-05:00')

describe('inviteLine', () => {
  const live = { expires_at: '2026-11-01T12:00:00-05:00' }

  it('says how long ago a live invite went out', () => {
    expect(inviteLine({ ...live, sent_at: '2026-10-30T08:00:00-05:00' }, now)).toBe('Invite pending · sent today')
    expect(inviteLine({ ...live, sent_at: '2026-10-29T08:00:00-05:00' }, now)).toBe('Invite pending · sent yesterday')
    expect(inviteLine({ ...live, sent_at: '2026-10-28T08:00:00-05:00' }, now)).toBe('Invite pending · sent 2 days ago')
  })

  it('says when an expired one ran out', () => {
    expect(inviteLine({ sent_at: '2026-10-07T10:00:00-05:00', expires_at: '2026-10-10T10:00:00-05:00' }, now)).toBe(
      'Invite expired · Oct 10',
    )
  })
})

describe('scopeLine', () => {
  it('names the restaurants', () => {
    expect(scopeLine('manager', ['Porter'])).toBe('Porter')
    expect(scopeLine('manager', ['Porter', 'Federale’s West Loop'])).toBe('Porter, Federale’s West Loop')
  })

  it('reads all restaurants by role, as the Users board does', () => {
    expect(scopeLine('ops', null)).toBe('All restaurants')
    expect(scopeLine('leadership', null)).toBe('All · read-only')
  })
})
