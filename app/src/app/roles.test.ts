import { describe, expect, it } from 'vitest'
import { ticketPath } from './roles'

describe('a ticket link', () => {
  it('opens the screen for each role, and none for those without one', () => {
    expect(ticketPath('manager', 'abc')).toBe('/tickets/abc')
    expect(ticketPath('ops', 'abc')).toBe('/ops/tickets/abc')
    expect(ticketPath('admin', 'abc')).toBeNull()
    expect(ticketPath('leadership', 'abc')).toBeNull()
  })

  it('keeps a strange id inside its path', () => {
    expect(ticketPath('ops', '../../admin/users')).toBe('/ops/tickets/..%2F..%2Fadmin%2Fusers')
  })
})
