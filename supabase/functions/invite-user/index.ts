import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { emailFrame, emailStyles as s, sendEmail } from '../_shared/email.ts'
import {
  can,
  coversScope,
  escapeHtml,
  getCaller,
  groupLabel,
  isAdmin,
  isUuid,
  json,
  refuse,
  serve,
  service,
} from '../_shared/http.ts'

/**
 * Invites, start to finish. `send` and `resend` need a signed-in caller holding
 * invite_users. Nobody grants access they do not have: anyone but an admin may
 * invite only managers, and only to restaurants in their own scope, since every
 * other role sees across restaurants. `check`, `accept` and
 * `request_new` are for the person holding the emailed link, who has no account
 * yet, so the link's token is the only credential: only its hash is stored, and
 * sending again replaces it, which kills the old link.
 */

const LIFETIME_HOURS = 72
const ROLES = ['manager', 'ops', 'leadership', 'admin'] as const
type Role = (typeof ROLES)[number]

const ROLE_PHRASE: Record<Role, string> = {
  manager: 'a Restaurant manager',
  ops: 'an Operations manager',
  leadership: 'a member of Leadership',
  admin: 'an Admin',
}
const ROLE_LABEL: Record<Role, string> = {
  manager: 'Restaurant manager',
  ops: 'Operations manager',
  leadership: 'Leadership',
  admin: 'Admin / IT',
}

type Invite = {
  id: string
  email: string
  full_name: string
  role: Role
  restaurant_ids: string[]
  status: 'pending' | 'accepted' | 'revoked'
  invited_by: string | null
  sent_at: string
  expires_at: string
  token_hash: string
  renewal_requested_at: string | null
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const expiry = () => new Date(Date.now() + LIFETIME_HOURS * 3600 * 1000).toISOString()
const isExpired = (invite: Pick<Invite, 'expires_at'>) => new Date(invite.expires_at).getTime() <= Date.now()

/** Names of the invite's restaurants, in list order; null means all of them. */
async function restaurantNames(db: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return null
  const { data, error } = await db.from('restaurants').select('name').in('id', ids).order('sort_order')
  if (error) throw error
  return (data ?? []).map((r) => r.name as string)
}

const listNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

async function sendInviteEmail(db: SupabaseClient, invite: Pick<Invite, 'email' | 'full_name' | 'role' | 'restaurant_ids'>, token: string, inviterId: string) {
  const appUrl = Deno.env.get('APP_URL')
  if (!appUrl) throw new Error('APP_URL is not set')
  // A fragment never reaches a server or its logs. The app reads it and posts it here.
  const link = `${appUrl.replace(/\/$/, '')}/invite#${token}`
  const [group, inviter, names] = await Promise.all([
    groupLabel(db),
    db.from('profiles').select('full_name').eq('id', inviterId).single(),
    restaurantNames(db, invite.restaurant_ids),
  ])
  if (inviter.error) throw inviter.error

  const first = invite.full_name.split(/\s+/)[0] ?? invite.full_name
  const where = names ? listNames(names) : 'all restaurants'
  const place = invite.role === 'manager' ? 'in your restaurant' : 'across your restaurants'
  const use = `Use OnTrack to report equipment issues, follow repairs and see the history of every piece of equipment ${place}.`
  const closing = `This link expires in ${LIFETIME_HOURS} hours. If you weren't expecting this invite, you can ignore this email.`
  const e = escapeHtml

  await sendEmail({
    to: invite.email,
    subject: "You're invited to OnTrack",
    text: `Hi ${first}, your team is on OnTrack.\n\n${inviter.data.full_name} invited you to join ${group} as ${ROLE_PHRASE[invite.role]} for ${where}.\n\n${use}\n\nSet up your account: ${link}\n\n${closing}`,
    html: emailFrame(`
<h1 style="${s.h1}">Hi ${e(first)}, your team is on OnTrack.</h1>
<p style="${s.p}">${e(inviter.data.full_name)} invited you to join <b>${e(group)}</b> as <b>${e(ROLE_PHRASE[invite.role])}</b> for <b>${e(where)}</b>.</p>
<p style="${s.p}">${e(use)}</p>
<a href="${e(link)}" style="${s.button}">Set up your account</a>
<p style="${s.small}">${e(closing)}</p>`),
  })
}

/** Caller rights shared by send and resend; a Response means refused. */
async function checkInviter(req: Request, role: Role, restaurantIds: string[]) {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  if (!(await can(caller, 'invite_users'))) return refuse('not_allowed', 403)
  if (role !== 'manager' && !(await isAdmin(caller))) return refuse('admin_only', 403)
  if (!(await coversScope(caller, restaurantIds))) return refuse('outside_your_scope', 403)
  return caller
}

async function send(req: Request, body: Record<string, unknown>) {
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role as Role
  const ids = Array.isArray(body.restaurant_ids) ? [...new Set(body.restaurant_ids)] : null
  if (fullName.length < 1 || fullName.length > 120) return refuse('bad_name', 422)
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return refuse('bad_email', 422)
  if (!ROLES.includes(role)) return refuse('bad_role', 422)
  if (!ids || !ids.every(isUuid)) return refuse('bad_restaurants', 422)
  // Empty means every restaurant, which a manager invite may not be.
  if (role === 'manager' && ids.length === 0) return refuse('manager_needs_restaurant', 422)

  const caller = await checkInviter(req, role, ids as string[])
  if (caller instanceof Response) return caller

  const db = service()
  if (ids.length) {
    const { data, error } = await db.from('restaurants').select('id').in('id', ids).is('archived_at', null)
    if (error) throw error
    if ((data ?? []).length !== ids.length) return refuse('bad_restaurants', 422)
  }

  const { data: existing, error: existingError } = await db
    .from('profiles')
    .select('id')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return refuse('email_taken', 409)

  const { data: pending, error: pendingError } = await db
    .from('invites')
    .select('id, expires_at')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .eq('status', 'pending')
    .maybeSingle()
  if (pendingError) throw pendingError
  if (pending && !isExpired(pending)) return refuse('already_invited', 409)
  if (pending) {
    const { error } = await db
      .from('invites')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', pending.id)
    if (error) throw error
  }

  const token = newToken()
  const { data: invite, error: insertError } = await db
    .from('invites')
    .insert({
      email,
      full_name: fullName,
      role,
      restaurant_ids: ids,
      token_hash: await hashToken(token),
      invited_by: caller.id,
      expires_at: expiry(),
    })
    .select('id')
    .single()
  if (insertError) {
    if (insertError.code === '23505') return refuse('already_invited', 409)
    throw insertError
  }

  try {
    await sendInviteEmail(db, { email, full_name: fullName, role, restaurant_ids: ids as string[] }, token, caller.id)
  } catch (e) {
    console.error(e)
    // Nobody received a link, so leave nothing behind and let the admin try again.
    await db.from('invites').delete().eq('id', invite.id)
    return refuse('email_failed', 502)
  }

  await db
    .from('audit_log')
    .insert({ actor_id: caller.id, action: 'invite.send', meta: { invite_id: invite.id, email, role } })
  return json({ id: invite.id })
}

async function resend(req: Request, body: Record<string, unknown>) {
  if (!isUuid(body.invite_id)) return refuse('bad_request', 422)
  const db = service()
  const { data, error } = await db.from('invites').select('*').eq('id', body.invite_id).maybeSingle()
  if (error) throw error
  const invite = data as Invite | null
  if (!invite) return refuse('not_found', 404)

  const caller = await checkInviter(req, invite.role, invite.restaurant_ids)
  if (caller instanceof Response) return caller
  if (invite.status !== 'pending') return refuse('not_pending', 409)

  const token = newToken()
  const { error: updateError } = await db
    .from('invites')
    .update({
      token_hash: await hashToken(token),
      sent_at: new Date().toISOString(),
      expires_at: expiry(),
      renewal_requested_at: null,
    })
    .eq('id', invite.id)
  if (updateError) throw updateError

  try {
    await sendInviteEmail(db, invite, token, caller.id)
  } catch (e) {
    console.error(e)
    // The old link still works, as it would have if this had never been pressed.
    await db
      .from('invites')
      .update({ token_hash: invite.token_hash, sent_at: invite.sent_at, expires_at: invite.expires_at })
      .eq('id', invite.id)
    return refuse('email_failed', 502)
  }

  await db
    .from('audit_log')
    .insert({ actor_id: caller.id, action: 'invite.resend', meta: { invite_id: invite.id, email: invite.email } })
  return json({ id: invite.id })
}

async function findByToken(db: SupabaseClient, token: unknown) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 200) return null
  const { data, error } = await db.from('invites').select('*').eq('token_hash', await hashToken(token)).maybeSingle()
  if (error) throw error
  return data as Invite | null
}

type LinkState = 'valid' | 'expired' | 'used' | 'invalid'
function linkState(invite: Invite | null): LinkState {
  if (!invite || invite.status === 'revoked') return 'invalid'
  if (invite.status === 'accepted') return 'used'
  return isExpired(invite) ? 'expired' : 'valid'
}

async function check(body: Record<string, unknown>) {
  const db = service()
  const invite = await findByToken(db, body.token)
  const state = linkState(invite)
  // What a link holder needs to set up the account, and only while it works.
  if (state !== 'valid' || !invite) return json({ state })
  const names = await restaurantNames(db, invite.restaurant_ids)
  return json({
    state,
    email: invite.email,
    full_name: invite.full_name,
    summary: `${ROLE_LABEL[invite.role]} · ${names ? listNames(names) : 'All restaurants'}`,
  })
}

/** Same rules as the Set up account screen. */
function strongEnough(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 12 &&
    password.length <= 72 &&
    /\d/.test(password) &&
    /[A-Z]/.test(password)
  )
}

async function accept(body: Record<string, unknown>) {
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  if (fullName.length < 1 || fullName.length > 120) return refuse('bad_name', 422)
  if (!strongEnough(body.password)) return refuse('weak_password', 422)

  const db = service()
  const invite = await findByToken(db, body.token)
  const state = linkState(invite)
  if (state !== 'valid' || !invite) return refuse(`link_${state}`, 409)

  // handle_new_user matches this token to the invite, takes role and restaurants
  // from the row and marks it accepted. Auth writes app_metadata only after the
  // insert, so the token travels in user_metadata, and is removed again below.
  const { data, error } = await db.auth.admin.createUser({
    email: invite.email,
    password: body.password,
    email_confirm: true,
    app_metadata: { invite_id: invite.id },
    user_metadata: { full_name: fullName, invite_token: body.token },
  })
  if (error) {
    if (error.code === 'email_exists') return refuse('link_used', 409)
    if (error.code === 'weak_password') return refuse('weak_password', 422)
    throw error
  }

  // Spent by now, but it has no reason to sit in every token this person is issued.
  const { error: cleanError } = await db.auth.admin.updateUserById(data.user.id, {
    user_metadata: { invite_token: null },
  })
  if (cleanError) console.error(cleanError)
  const { error: nameError } = await db.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
  if (nameError) console.error(nameError)
  await db.from('audit_log').insert({
    actor_id: data.user.id,
    action: 'invite.accept',
    target_user_id: data.user.id,
    meta: { invite_id: invite.id },
  })
  return json({ email: invite.email })
}

/** "Ask admin for a new invite" on the Link expired screen: at most one email a day. */
async function requestNew(body: Record<string, unknown>) {
  const db = service()
  const invite = await findByToken(db, body.token)
  if (linkState(invite) !== 'expired' || !invite) return refuse('not_expired', 409)
  const asked = invite.renewal_requested_at ? new Date(invite.renewal_requested_at).getTime() : 0
  if (Date.now() - asked < 24 * 3600 * 1000) return json({ sent: true })

  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const { data: inviter, error } = invite.invited_by
    ? await db
        .from('profiles')
        .select('email')
        .eq('id', invite.invited_by)
        .is('deactivated_at', null)
        .maybeSingle()
    : { data: null, error: null }
  if (error) throw error

  let to = inviter?.email as string | undefined
  if (!to) {
    const { data: admin, error: adminError } = await db
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .is('deactivated_at', null)
      .limit(1)
      .maybeSingle()
    if (adminError) throw adminError
    to = admin?.email
  }
  if (!to) return refuse('nobody_to_ask', 409)

  const e = escapeHtml
  const line = `${invite.full_name}'s invite expired and they asked for a new one.`
  try {
    await sendEmail({
      to,
      subject: `${invite.full_name} needs a new OnTrack invite`,
      text: `${line}\n\nResend it from Users: ${appUrl}/admin/users`,
      html: emailFrame(`
<h1 style="${s.h1}">${e(invite.full_name)} needs a new invite</h1>
<p style="${s.p}">${e(line)}</p>
<a href="${e(appUrl)}/admin/users" style="${s.button}">Open Users</a>`),
    })
  } catch (err) {
    console.error(err)
    return refuse('email_failed', 502)
  }
  await db.from('invites').update({ renewal_requested_at: new Date().toISOString() }).eq('id', invite.id)
  return json({ sent: true })
}

serve((req, body) => {
  switch (body.action) {
    case 'send':
      return send(req, body)
    case 'resend':
      return resend(req, body)
    case 'check':
      return check(body)
    case 'accept':
      return accept(body)
    case 'request_new':
      return requestNew(body)
    default:
      return Promise.resolve(refuse('bad_request', 400))
  }
})
