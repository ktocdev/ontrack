import type { AppRole } from '../lib/supabase'
import type { Profile, Restaurant } from './types'

/**
 * Fixtures for the e2e build (VITE_E2E_MOCK=1) so shells can be driven
 * without a backend. Same people and restaurants as supabase/seed.sql.
 */

const now = '2026-10-01T00:00:00Z'

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    name: 'Federale’s Logan Square',
    address: '2600 N Milwaukee Ave, Chicago',
    phone: '(312) 555-0141',
    color: '#A3336D',
    manager_id: '22222222-2222-4222-8222-000000000001',
    sort_order: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'Federale’s West Loop',
    address: '180 N Morgan St, Chicago',
    phone: '(312) 555-0142',
    color: '#6B3FA0',
    manager_id: null,
    sort_order: 2,
    created_at: now,
    updated_at: now,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    name: 'Porter',
    address: '1400 W Randolph St, Chicago',
    phone: '(312) 555-0143',
    color: '#9A6A00',
    manager_id: null,
    sort_order: 3,
    created_at: now,
    updated_at: now,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    name: 'Ranalli’s Logan Square',
    address: '2700 N Kedzie Ave, Chicago',
    phone: '(312) 555-0144',
    color: '#1B4F91',
    manager_id: '22222222-2222-4222-8222-000000000002',
    sort_order: 4,
    created_at: now,
    updated_at: now,
  },
]

function profile(id: string, full_name: string, email: string, role: AppRole, home: string | null): Profile {
  return {
    id,
    full_name,
    email,
    phone: null,
    avatar_path: null,
    role,
    home_restaurant_id: home,
    deactivated_at: null,
    created_at: now,
    updated_at: now,
  }
}

export const MOCK_USERS: Record<AppRole, Profile> = {
  manager: profile(
    '22222222-2222-4222-8222-000000000001',
    'Maya Reyes',
    'maya.reyes@example.com',
    'manager',
    MOCK_RESTAURANTS[0]!.id,
  ),
  ops: profile('22222222-2222-4222-8222-000000000003', 'Bert Velilla', 'bert.velilla@example.com', 'ops', null),
  leadership: profile('22222222-2222-4222-8222-000000000005', 'Lee Chen', 'lee.chen@example.com', 'leadership', null),
  admin: profile('22222222-2222-4222-8222-000000000006', 'Four Corners Admin', 'admin@example.com', 'admin', null),
}

export const MOCK_ROLE_KEY = 'ontrack.e2e-role'

export function readMockRole(): AppRole | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('as')
    if (fromUrl && fromUrl in MOCK_USERS) {
      localStorage.setItem(MOCK_ROLE_KEY, fromUrl)
      return fromUrl as AppRole
    }
    const stored = localStorage.getItem(MOCK_ROLE_KEY)
    return stored && stored in MOCK_USERS ? (stored as AppRole) : null
  } catch {
    return null
  }
}

export function writeMockRole(role: AppRole | null) {
  try {
    if (role) localStorage.setItem(MOCK_ROLE_KEY, role)
    else localStorage.removeItem(MOCK_ROLE_KEY)
  } catch {
    // ignore
  }
}
