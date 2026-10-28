import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'
import { MOCK_RESTAURANTS, MOCK_USERS, readMockRole, writeMockRole } from './mock'
import type { AuthState, Profile, Restaurant } from './types'

/**
 * Who is signed in, what their profile says, and which restaurants they can
 * see. The session comes from Supabase Auth; the profile and restaurants come
 * from the tables under row-level security, so what the app sees is exactly
 * what the database allows.
 */

type Me = { profile: Profile | null; restaurants: Restaurant[]; allRestaurants: boolean }

async function loadMe(userId: string): Promise<Me> {
  const sb = supabase!
  const [profileRes, membershipsRes, restaurantsRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('memberships').select('restaurant_id').eq('user_id', userId),
    sb.from('restaurants').select('*').order('sort_order'),
  ])
  if (profileRes.error) throw profileRes.error
  if (membershipsRes.error) throw membershipsRes.error
  if (restaurantsRes.error) throw restaurantsRes.error
  return {
    profile: profileRes.data,
    restaurants: restaurantsRes.data ?? [],
    allRestaurants: (membershipsRes.data ?? []).some((m) => m.restaurant_id === null),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (env.e2eMock) return <MockAuthProvider>{children}</MockAuthProvider>
  if (!supabase) return <AuthContext.Provider value={{ status: 'unconfigured' }}>{children}</AuthContext.Provider>
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const sb = supabase!
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    sb.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) queryClient.removeQueries({ queryKey: ['me'] })
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [sb, queryClient])

  const userId = session?.user.id
  const me = useQuery({
    queryKey: ['me', userId],
    queryFn: () => loadMe(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  })

  const signOut = useCallback(async () => {
    await sb.auth.signOut()
  }, [sb])

  const value = useMemo<AuthState>(() => {
    if (session === undefined) return { status: 'loading' }
    if (session === null) return { status: 'signed-out' }
    if (me.isPending) return { status: 'loading' }
    if (me.isError || !me.data?.profile) {
      return { status: 'no-profile', email: session.user.email ?? null, signOut }
    }
    return {
      status: 'signed-in',
      user: me.data.profile,
      restaurants: me.data.restaurants,
      allRestaurants: me.data.allRestaurants,
      signOut,
    }
  }, [session, me.isPending, me.isError, me.data, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState(readMockRole)

  const value = useMemo<AuthState>(() => {
    const signOut = async () => {
      writeMockRole(null)
      setRole(null)
    }
    if (!role) return { status: 'signed-out' }
    const user = MOCK_USERS[role]
    const restaurants =
      role === 'manager' ? MOCK_RESTAURANTS.filter((r) => r.id === user.home_restaurant_id) : MOCK_RESTAURANTS
    return { status: 'signed-in', user, restaurants, allRestaurants: role !== 'manager', signOut }
  }, [role])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
