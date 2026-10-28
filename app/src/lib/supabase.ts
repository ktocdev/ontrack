import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env, supabaseConfigured } from './env'

export type Db = Database['public']
export type Tables<T extends keyof Db['Tables']> = Db['Tables'][T]['Row']
export type Views<T extends keyof Db['Views']> = Db['Views'][T]['Row']
export type Enums<T extends keyof Db['Enums']> = Db['Enums'][T]

export type AppRole = Enums<'app_role'>
export type TicketStatus = Enums<'ticket_status'>

/**
 * The one Supabase client. Null when the build has no URL and anon key, so a
 * fresh checkout renders a clear "not configured" screen instead of crashing.
 */
export const supabase: SupabaseClient<Database> | null = supabaseConfigured
  ? createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ontrack.auth',
      },
    })
  : null

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  return supabase
}
