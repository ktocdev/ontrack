import { describe, expect, it } from 'vitest'
import { byUrgency, reopenReasons } from './dashboard'

describe('byUrgency', () => {
  it('puts urgent first, then the most recent activity', () => {
    const list = [
      { id: 'old-normal', urgency: 'normal', activity: '2026-10-01T10:00:00Z' },
      { id: 'old-urgent', urgency: 'urgent', activity: '2026-10-01T10:00:00Z' },
      { id: 'new-normal', urgency: 'normal', activity: '2026-10-02T10:00:00Z' },
      { id: 'new-urgent', urgency: 'urgent', activity: '2026-10-02T10:00:00Z' },
    ]
    expect([...list].sort(byUrgency).map((t) => t.id)).toEqual(['new-urgent', 'old-urgent', 'new-normal', 'old-normal'])
  })
})

describe('reopenReasons', () => {
  const ticket = { id: 't', reopened_at: '2026-10-20T12:00:00Z' }
  const row = (body: string | null, created_at: string, ticket_id = 't') => ({
    ticket_id,
    kind: 'message',
    body,
    created_at,
  })

  it('takes the first words at or after the reopen', () => {
    const reasons = reopenReasons(
      [ticket],
      [
        row('Before it closed', '2026-10-10T12:00:00Z'),
        row(null, '2026-10-20T12:00:00Z'),
        row('It is back', '2026-10-20T12:00:00Z'),
        row('Ops replied later', '2026-10-20T13:00:00Z'),
      ],
    )
    expect(reasons.get('t')).toBe('It is back')
  })

  it('has nothing to say with no words, or for another ticket', () => {
    expect(reopenReasons([ticket], [row('Elsewhere', '2026-10-21T12:00:00Z', 'other')]).has('t')).toBe(false)
    expect(reopenReasons([{ id: 't', reopened_at: null }], []).has('t')).toBe(false)
  })
})
