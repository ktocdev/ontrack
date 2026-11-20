import { describe, expect, it } from 'vitest'
import { ADMIN_VIEW_TABS, adminOnTop, equipmentPath, ROLE_TABS, roleNames, tabsFor, ticketPath } from './roles'

describe('a ticket link', () => {
  it('opens the screen for each role, and none for those without one', () => {
    expect(ticketPath('manager', 'abc')).toBe('/tickets/abc')
    expect(ticketPath('ops', 'abc')).toBe('/ops/tickets/abc')
    expect(ticketPath('admin', 'abc')).toBe('/admin/tickets/abc')
    expect(ticketPath('leadership', 'abc')).toBe('/lead/tickets/abc')
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

describe('role names', () => {
  it("keep each screen's own words until the group names a role", () => {
    const names = roleNames({})
    expect(names.name('manager')).toBe('Manager')
    expect(names.name('ops', 'Ops')).toBe('Ops')
    expect(names.short('leadership')).toBe('Lead')
  })

  it("use the group's name and short name where it has one", () => {
    const names = roleNames({
      manager: { name: 'Reporter', short: 'Rep' },
      ops: { name: 'Support Team', short: 'Support' },
    })
    expect(names.name('manager', 'Restaurant manager')).toBe('Reporter')
    expect(names.short('ops')).toBe('Support')
    expect(names.name('admin')).toBe('Admin')
  })

  it('ignore anything that is not a name and a short name', () => {
    const names = roleNames({ manager: { name: '  ', short: 'R' }, ops: 'Support', chef: { name: 'Chef', short: 'C' } })
    expect(names.named).toEqual({})
    expect(roleNames(null).named).toEqual({})
    expect(roleNames(['manager']).named).toEqual({})
  })
})

describe('the admin view', () => {
  const rosa = { role: 'ops' as const, is_admin: true }
  const bert = { role: 'ops' as const, is_admin: false }
  const plain = { role: 'admin' as const, is_admin: true }

  it('is for someone holding Admin on top of a role, not the plain Admin account', () => {
    expect(adminOnTop(rosa)).toBe(true)
    expect(adminOnTop(bert)).toBe(false)
    expect(adminOnTop(plain)).toBe(false)
  })

  it('has its own tabs under /admin and the role’s anywhere else', () => {
    expect(tabsFor(rosa, '/admin/users')).toBe(ADMIN_VIEW_TABS)
    expect(tabsFor(rosa, '/admin')).toBe(ADMIN_VIEW_TABS)
    expect(tabsFor(rosa, '/ops')).toBe(ROLE_TABS.ops)
    expect(tabsFor(rosa, '/administer')).toBe(ROLE_TABS.ops)
    expect(tabsFor(bert, '/admin/users')).toBe(ROLE_TABS.ops)
    expect(tabsFor(plain, '/admin/users')).toBe(ROLE_TABS.admin)
  })
})

describe('a tab lit by a ticket opened from its list', () => {
  const id = '66666666-6666-4666-8666-000000001042'
  const open = ROLE_TABS.manager.items.find((t) => t.label === 'Open tickets')!.lightsOn!
  const dashboard = ROLE_TABS.ops.items.find((t) => t.label === 'Dashboard')!.lightsOn!

  it('lights Open tickets on a ticket and Closed tickets, never on Create ticket', () => {
    expect(open.test(`/tickets/${id}`)).toBe(true)
    expect(open.test(`/tickets/${id}/edit`)).toBe(true)
    expect(open.test('/tickets/closed')).toBe(true)
    expect(open.test('/tickets/new')).toBe(false)
    expect(open.test('/tickets/new/abc')).toBe(false)
  })

  it('lights Dashboard on an Ops ticket only', () => {
    expect(dashboard.test(`/ops/tickets/${id}`)).toBe(true)
    expect(dashboard.test('/ops/equipment')).toBe(false)
  })
})
