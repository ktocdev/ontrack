/**
 * Build-time configuration. Vite inlines VITE_* variables; nothing here is a
 * secret (the anon key is public by design, row-level security does the work).
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  /** Set only by the e2e build so shells can be exercised without a backend. */
  e2eMock: import.meta.env.VITE_E2E_MOCK === '1',
}

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
