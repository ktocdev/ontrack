import { describe, expect, it } from 'vitest'
import { equipmentPath, ticketPath } from './roles'

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

describe('an equipment link', () => {
  it('opens the unit for each role, and none for those without an equipment screen', () => {
    expect(equipmentPath('manager', 'abc')).toBe('/equipment/abc')
    expect(equipmentPath('ops', 'abc')).toBe('/ops/equipment/abc')
    expect(equipmentPath('admin', 'abc')).toBeNull()
    expect(equipmentPath('leadership', 'abc')).toBeNull()
  })

  it('keeps a strange id inside its path', () => {
    expect(equipmentPath('manager', '../admin/users')).toBe('/equipment/..%2Fadmin%2Fusers')
  })
})
