/**
 * Build-time configuration. Vite inlines VITE_* variables; nothing here is a
 * secret (the anon key is public by design, row-level security does the work).
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  /** Help & support contact rows; each row hides when its variable is unset. */
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || undefined,
  supportPhone: (import.meta.env.VITE_SUPPORT_PHONE as string | undefined) || undefined,
  /** package.json version, stamped by vite.config. */
  appVersion: __APP_VERSION__,
}

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
