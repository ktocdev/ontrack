import { can, coversScope, getCaller, isAdmin, isUuid, json, refuse, serve, service } from '../_shared/http.ts'

/**
 * Taking someone's access away, and giving it back. `revoke_invite` kills a
 * pending invite. `deactivate` sets profiles.deactivated_at, which closes every
 * policy, and bans the auth user so their refresh token stops working too;
 * `reactivate` undoes both. The caller needs invite_users, and nobody can
 * deactivate themselves, so a group always keeps the admin who pressed the
 * button. Anyone but an admin may act only on managers, or invites for managers,
 * whose restaurants are all in their own scope. These writes bypass row-level
 * security, so this is the only place that rule is enforced.
 */

// About 100 years; Supabase Auth has no "forever".
const BAN = '876000h'

serve(async (req, body) => {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  if (!(await can(caller, 'invite_users'))) return refuse('not_allowed', 403)
  const db = service()

  /** A refusal when a non-admin caller may not act on this role and these restaurants. */
  const outOfBounds = async (role: string, restaurantIds: string[]) => {
    if (await isAdmin(caller)) return null
    if (role !== 'manager') return refuse('admin_only', 403)
    return (await coversScope(caller, restaurantIds)) ? null : refuse('outside_your_scope', 403)
  }

  if (body.action === 'revoke_invite') {
    if (!isUuid(body.invite_id)) return refuse('bad_request', 422)
    const { data: invite, error } = await db
      .from('invites')
      .select('id, email, role, status, restaurant_ids')
      .eq('id', body.invite_id)
      .maybeSingle()
    if (error) throw error
    if (!invite) return refuse('not_found', 404)
    const refused = await outOfBounds(invite.role, invite.restaurant_ids)
    if (refused) return refused
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
    const { data: memberships, error: membershipsError } = await db
      .from('memberships')
      .select('restaurant_id')
      .eq('user_id', target.id)
    if (membershipsError) throw membershipsError
    // A null restaurant is the all-restaurants row, which only that same scope covers.
    const rows = memberships ?? []
    const ids = rows.some((m) => m.restaurant_id === null) ? [] : rows.map((m) => m.restaurant_id as string)
    const refused = await outOfBounds(target.role, ids)
    if (refused) return refused

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

  // For a mistake or a test account: an admin may delete one while nothing points
  // to it. Anything else is deactivated, so the name stays on the history.
  if (body.action === 'delete') {
    if (!isUuid(body.user_id)) return refuse('bad_request', 422)
    if (body.user_id === caller.id) return refuse('not_yourself', 409)
    if (!(await isAdmin(caller))) return refuse('admin_only', 403)
    const { data: history, error } = await caller.db
      .from('v_person_history')
      .select('records')
      .eq('user_id', body.user_id)
      .maybeSingle()
    if (error) throw error
    if (!history) return refuse('not_found', 404)
    if (history.records > 0) return refuse('has_history', 409)

    const { data: target, error: targetError } = await db
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', body.user_id)
      .single()
    if (targetError) throw targetError

    // These two only say who was involved, and would otherwise block the delete.
    const cleared = await Promise.all([
      db.from('invites').update({ user_id: null }).eq('user_id', body.user_id),
      db.from('rights').update({ updated_by: null }).eq('updated_by', body.user_id),
    ])
    for (const r of cleared) if (r.error) throw r.error

    // Logged first: the entry keeps the name once the row is gone.
    await db.from('audit_log').insert({
      actor_id: caller.id,
      action: 'user.delete',
      meta: { user_id: body.user_id, name: target.full_name, email: target.email, role: target.role },
    })
    const { error: deleteError } = await db.auth.admin.deleteUser(body.user_id)
    if (deleteError) throw deleteError
    return json({ ok: true })
  }

  return refuse('bad_request', 400)
})
