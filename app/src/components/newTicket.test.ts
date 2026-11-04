import { describe, expect, it } from 'vitest'
import { NEW_FOR_MS, ringUntil } from './newTicket'

describe('the new-ticket ring', () => {
  const created = '2026-11-04T15:00:00Z'

  it('lasts 5 minutes from when the ticket was opened', () => {
    expect(ringUntil(created, 'open')).toBe(new Date(created).getTime() + NEW_FOR_MS)
    expect(NEW_FOR_MS).toBe(300_000)
  })

  it('never rings a reopened ticket, or a card with no time', () => {
    expect(ringUntil(created, 'reopened')).toBe(0)
    expect(ringUntil(undefined, 'open')).toBe(0)
  })
})
