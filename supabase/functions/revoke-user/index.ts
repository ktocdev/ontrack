import { can, getCaller, isAdmin, isUuid, json, refuse, serve, service } from '../_shared/http.ts'

/**
 * Taking someone's access away, and giving it back. `revoke_invite` kills a
 * pending invite. `deactivate` sets profiles.deactivated_at, which closes every
 * policy, and bans the auth user so their refresh token stops working too;
 * `reactivate` undoes both. The caller needs invite_users, only an admin may
 * act on an admin, and nobody can deactivate themselves, so a group always keeps
 * the admin who pressed the button.
 */

// About 100 years; Supabase Auth has no "forever".
const BAN = '876000h'

serve(async (req, body) => {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  if (!(await can(caller, 'invite_users'))) return refuse('not_allowed', 403)
  const db = service()

  if (body.action === 'revoke_invite') {
    if (!isUuid(body.invite_id)) return refuse('bad_request', 422)
    const { data: invite, error } = await db
      .from('invites')
      .select('id, email, role, status')
      .eq('id', body.invite_id)
      .maybeSingle()
    if (error) throw error
    if (!invite) return refuse('not_found', 404)
    if (invite.role === 'admin' && !(await isAdmin(caller))) return refuse('admin_only', 403)
    if (invite.status !== 'pending') return refuse('not_pending', 409)

    const { error: updateError } = await db
      .from('invites')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', invite.id)
    if (updateError) throw updateError
    await db
      .from('audit_log')
      .insert({ actor_id: caller.id, action: 'invite.revoke', meta: { invite_id: invite.id, email: invite.email } })
    return json({ ok: true })
  }

  if (body.action === 'deactivate' || body.action === 'reactivate') {
    if (!isUuid(body.user_id)) return refuse('bad_request', 422)
    if (body.user_id === caller.id) return refuse('not_yourself', 409)
    const { data: target, error } = await db
      .from('profiles')
      .select('id, role')
      .eq('id', body.user_id)
      .maybeSingle()
    if (error) throw error
    if (!target) return refuse('not_found', 404)
    if (target.role === 'admin' && !(await isAdmin(caller))) return refuse('admin_only', 403)

    const off = body.action === 'deactivate'
    // Ban first when turning off and last when turning on, so a failure halfway
    // leaves the person locked out rather than let back in.
    const setBan = () => db.auth.admin.updateUserById(target.id, { ban_duration: off ? BAN : 'none' })
    if (off) {
      const { error: banError } = await setBan()
      if (banError) throw banError
    }
    const { error: updateError } = await db
      .from('profiles')
      .update({ deactivated_at: off ? new Date().toISOString() : null })
      .eq('id', target.id)
    if (updateError) throw updateError
    if (!off) {
      const { error: banError } = await setBan()
      if (banError) throw banError
    }

    await db
      .from('audit_log')
      .insert({ actor_id: caller.id, action: off ? 'user.deactivate' : 'user.reactivate', target_user_id: target.id })
    return json({ ok: true })
  }

  return refuse('bad_request', 400)
})
