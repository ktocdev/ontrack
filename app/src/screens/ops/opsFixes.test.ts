import { describe, expect, it } from 'vitest'
import { convertedLine, convertedNotice, fixedLine } from './opsFixes'

const now = new Date('2026-11-18T15:00:00')

describe('fixedLine', () => {
  it('names who fixed it and both days, as the board does', () => {
    expect(fixedLine('2026-10-22T15:00:00', 'Maya Reyes', '2026-10-21T15:00:00', now)).toBe(
      'Fixed Oct 22 by Maya · added Oct 21',
    )
  })
  it('says today, and leaves out a name it lacks', () => {
    expect(fixedLine('2026-11-18T09:00:00', null, '2026-11-18T08:00:00', now)).toBe('Fixed today · added today')
  })
})

describe('convertedLine', () => {
  it('says you when it was you', () => {
    expect(convertedLine({ id: 'me', name: 'Bert Velilla' }, 'me', 'Added Oct 23 by Maya')).toBe(
      'Converted by you · Added Oct 23 by Maya',
    )
  })
  it('names someone else on the team by first name', () => {
    expect(convertedLine({ id: 'b', name: 'Chris Novak' }, 'me', 'Added Oct 23')).toBe(
      'Converted by Chris · Added Oct 23',
    )
  })
})

describe('convertedNotice', () => {
  it('names the ticket, and has a line without it', () => {
    expect(convertedNotice('OT-1058')).toBe('Converted to OT-1058. It’s on your dashboard.')
    expect(convertedNotice(null)).toBe('Converted to a ticket. It’s on your dashboard.')
  })
})
