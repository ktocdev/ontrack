import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * What every OnTrack function shares. These run with the service key, which
 * bypasses row-level security, so each one checks its caller first. The caller
 * client below carries the caller's own token, so can() and is_admin() answer
 * for them; the service client is only for the writes people may not make.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/** A refusal the app can show: `error` is a stable code, never a database message. */
export function refuse(error: string, status: number) {
  return json({ error }, status)
}

export function service(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Caller = { id: string; db: SupabaseClient }

/** Who is calling, from their token; null when signed out or the token is bad. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const header = req.headers.get('Authorization')
  const token = header?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, db }
}

/** Answer CORS preflight and refuse anything but a JSON POST. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return refuse('method_not_allowed', 405)
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return refuse('bad_request', 400)
    }
    if (typeof body !== 'object' || body === null) return refuse('bad_request', 400)
    try {
      return await handler(req, body as Record<string, unknown>)
    } catch (e) {
      // The detail goes to the function log, never to the caller.
      console.error(e)
      return refuse('server_error', 500)
    }
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

export async function can(caller: Caller, action: string) {
  const { data, error } = await caller.db.rpc('can', { action })
  if (error) throw error
  return data === true
}

export async function isAdmin(caller: Caller) {
  const { data, error } = await caller.db.rpc('is_admin')
  if (error) throw error
  return data === true
}

/** The group's name as the boards show it: "4C | Four Corners". */
export async function groupLabel(db: SupabaseClient) {
  const { data, error } = await db.from('group_settings').select('name, short_name').single()
  if (error) throw error
  return data.short_name ? `${data.short_name} | ${data.name}` : (data.name as string)
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
