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

export const ROLE_LABEL: Record<AppRole, string> = {
  manager: 'Manager',
  ops: 'Ops Manager',
  admin: 'Admin',
  leadership: 'Leadership',
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
      { to: '/ops', label: 'Dashboard', icon: IconDashboard, end: true },
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

/** Where "Search equipment" on the 404 screen goes for each role. */
export const ROLE_EQUIPMENT: Record<AppRole, string> = {
  manager: '/equipment',
  ops: '/ops/equipment',
  admin: '/admin/tickets',
  leadership: '/lead/restaurants',
}
