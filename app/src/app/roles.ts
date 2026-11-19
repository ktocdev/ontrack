import type { TabItem } from '../components/TabBar'
import {
  IconBriefcase,
  IconBuilding,
  IconClipboardCheck,
  IconDashboard,
  IconList,
  IconPlusSquare,
  IconShieldCheck,
  IconStorefront,
  IconUsers,
  IconWrench,
} from '../components/icons'
import type { AppRole } from '../lib/supabase'

/**
 * Where each role lives. Paths follow the design's href links: the manager
 * tabs are Create ticket / Open tickets / Walkthrough / Equipment, ops has
 * Dashboard / Walkthroughs / Equipment / Contractors, admin has Users / Roles
 * & rights / Tickets / Restaurants, leadership has Overview / Restaurants /
 * Walkthroughs / Contractors.
 */
export const ROLE_HOME: Record<AppRole, string> = {
  manager: '/tickets',
  ops: '/ops',
  admin: '/admin/users',
  leadership: '/lead',
}

/** A role's tag as the boards draw it, until the group names the role (`useRoleNames`). */
export const ROLE_LABEL: Record<AppRole, string> = {
  manager: 'Manager',
  ops: 'Ops Manager',
  admin: 'Admin',
  leadership: 'Leadership',
}

/** The Roles & rights grid's narrow column heads, until the group names the role. */
export const ROLE_HEAD: Record<AppRole, string> = { manager: 'Mgr', ops: 'Ops', leadership: 'Lead', admin: 'Admin' }

export type RoleName = { name: string; short: string }
export const ROLES: AppRole[] = ['manager', 'ops', 'leadership', 'admin']

/**
 * The roles the group has named (OT-114), from `group_settings.role_names`; anything
 * malformed is left out. A role not named keeps the words each screen's board uses, so
 * nothing changes until an admin renames one.
 */
export function namedRoles(stored: unknown): Partial<Record<AppRole, RoleName>> {
  const out: Partial<Record<AppRole, RoleName>> = {}
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return out
  for (const role of ROLES) {
    const v = (stored as Record<string, unknown>)[role] as Partial<RoleName> | undefined
    if (v && typeof v.name === 'string' && v.name.trim() && typeof v.short === 'string' && v.short.trim()) {
      out[role] = { name: v.name.trim(), short: v.short.trim() }
    }
  }
  return out
}

/** What a screen calls a role: the group's name for it, or the screen's own word. */
export type RoleNames = {
  named: Partial<Record<AppRole, RoleName>>
  name: (role: AppRole, fallback?: string) => string
  short: (role: AppRole) => string
}

export function roleNames(stored: unknown): RoleNames {
  const named = namedRoles(stored)
  return {
    named,
    name: (role, fallback = ROLE_LABEL[role]) => named[role]?.name ?? fallback,
    short: (role) => named[role]?.short ?? ROLE_HEAD[role],
  }
}

export const ROLE_TABS: Record<AppRole, { label: string; items: TabItem[] }> = {
  manager: {
    label: 'Manager',
    items: [
      { to: '/tickets/new', label: 'Create ticket', icon: IconPlusSquare },
      { to: '/tickets', label: 'Open tickets', icon: IconList, end: true, also: '/tickets/in-house' },
      { to: '/walkthrough', label: 'Walkthrough', icon: IconClipboardCheck },
      { to: '/equipment', label: 'Equipment', icon: IconWrench },
    ],
  },
  ops: {
    label: 'Operations',
    items: [
      { to: '/ops', label: 'Dashboard', icon: IconDashboard, end: true, also: '/ops/closed' },
      { to: '/ops/walkthroughs', label: 'Walkthroughs', icon: IconClipboardCheck },
      { to: '/ops/equipment', label: 'Equipment', icon: IconWrench },
      { to: '/ops/contractors', label: 'Contractors', icon: IconBriefcase },
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users', icon: IconUsers },
      { to: '/admin/roles', label: 'Roles & rights', icon: IconShieldCheck },
      { to: '/admin/tickets', label: 'Tickets', icon: IconList },
      { to: '/admin/restaurants', label: 'Restaurants', icon: IconBuilding },
    ],
  },
  leadership: {
    label: 'Leadership',
    items: [
      { to: '/lead', label: 'Overview', icon: IconDashboard, end: true },
      { to: '/lead/restaurants', label: 'Restaurants', icon: IconStorefront },
      { to: '/lead/walkthroughs', label: 'Walkthroughs', icon: IconClipboardCheck },
      { to: '/lead/contractors', label: 'Contractors', icon: IconBriefcase },
    ],
  },
}

/**
 * The admin view's tabs for someone who holds Admin on top of their role (OT-123): no
 * Tickets tab, since they have their role's own ticket screens. A plain Admin account keeps
 * ROLE_TABS.admin, with the Tickets tab Phase 7 fills.
 */
export const ADMIN_VIEW_TABS: { label: string; items: TabItem[] } = {
  label: 'Admin',
  items: [
    { to: '/admin/users', label: 'Users', icon: IconUsers },
    { to: '/admin/roles', label: 'Roles & rights', icon: IconShieldCheck },
    { to: '/admin/restaurants', label: 'Restaurants', icon: IconBuilding },
  ],
}

/** Whether an address is in the admin view, whose tab bar is the admin's. */
export const inAdminView = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/')

/**
 * Holds Admin on top of a working role (OT-122), so has the shield, the admin view's tabs and
 * the Admin tag. The plain Admin role holds it too, but lives in the admin screens already.
 */
export const adminOnTop = (p: { role: AppRole; is_admin: boolean }) => p.is_admin && p.role !== 'admin'

/** The tab bar for a screen: the admin view's under /admin, the person's role's anywhere else. */
export function tabsFor(user: { role: AppRole; is_admin: boolean }, pathname: string) {
  return adminOnTop(user) && inAdminView(pathname) ? ADMIN_VIEW_TABS : ROLE_TABS[user.role]
}

/** Where a ticket's lasting link leads for each role; leadership's (OT-145) and the plain admin's (OT-148) are read-only. */
export function ticketPath(role: AppRole, id: string) {
  const safe = encodeURIComponent(id)
  if (role === 'manager') return `/tickets/${safe}`
  if (role === 'ops') return `/ops/tickets/${safe}`
  if (role === 'leadership') return `/lead/tickets/${safe}`
  return `/admin/tickets/${safe}`
}

/** Where a unit's lasting link leads for each role; admin and leadership have no equipment screen. */
export function equipmentPath(role: AppRole, id: string) {
  const safe = encodeURIComponent(id)
  if (role === 'manager') return `/equipment/${safe}`
  if (role === 'ops') return `/ops/equipment/${safe}`
  return null
}

/**
 * Where a contractor's lasting link opens for each role: Ops's contractor page, or
 * leadership's read-only one (OT-146). Nobody else has contractor screens.
 */
export function contractorPath(role: AppRole, id: string) {
  const safe = encodeURIComponent(id)
  if (role === 'ops') return `/ops/contractors/${safe}`
  if (role === 'leadership') return `/lead/contractors/${safe}`
  return null
}

/** Where "Search equipment" on the 404 screen goes for each role. */
export const ROLE_EQUIPMENT: Record<AppRole, string> = {
  manager: '/equipment',
  ops: '/ops/equipment',
  admin: '/admin/tickets',
  leadership: '/lead/restaurants',
}
