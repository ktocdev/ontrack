import { emailFrame, emailStyles as s, sendEmail } from '../_shared/email.ts'
import { escapeHtml, getCaller, isAdmin, isUuid, json, refuse, serve, service } from '../_shared/http.ts'

/**
 * Admin · Reset 2-step verification, for someone who has lost their phone and their
 * backup codes. It removes their authenticator, codes, remembered phones, passes and
 * sessions, and they set it up again at next sign-in. Auth lets only the service key remove a
 * verified factor. Nobody resets their own: that would turn a stolen password and an
 * open session into a way past the second step.
 */

serve(async (req, body) => {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  if (!(await isAdmin(caller))) return refuse('admin_only', 403)
  if (!isUuid(body.user_id)) return refuse('bad_request', 422)
  if (body.user_id === caller.id) return refuse('not_yourself', 409)
  const db = service()

  const { data: target, error } = await db
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', body.user_id)
    .maybeSingle()
  if (error) throw error
  if (!target) return refuse('not_found', 404)

  // Logged first, and the reset row before anything is removed: it kills every token
  // issued so far, so a failure from here on can only leave them more locked out.
  const { error: logError } = await db
    .from('audit_log')
    .insert({ actor_id: caller.id, action: 'two_step.reset', target_user_id: target.id })
  if (logError) throw logError
  const { error: resetError } = await db
    .from('two_step_resets')
    .upsert({ user_id: target.id, reset_at: new Date().toISOString(), answered_at: null })
  if (resetError) throw resetError

  const cleared = await Promise.all(
    ['two_step_codes', 'two_step_devices', 'two_step_passes'].map((table) =>
      db.from(table).delete().eq('user_id', target.id),
    ),
  )
  for (const r of cleared) if (r.error) throw r.error

  const { data: factors, error: listError } = await db.auth.admin.mfa.listFactors({ userId: target.id })
  if (listError) throw listError
  for (const factor of factors.factors) {
    const { error: deleteError } = await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId: target.id })
    if (deleteError) throw deleteError
  }

  // Last, or a live attacker could refresh to a new token and enroll their own authenticator.
  const { error: sessionsError } = await db.rpc('end_sessions', { p_user: target.id })
  if (sessionsError) throw sessionsError

  // The reset has happened either way, and the admin is told if this part failed.
  let emailed = true
  try {
    await sendEmail({
      to: target.email,
      subject: 'Your 2-step verification was reset',
      html: emailFrame(`
<h1 style="${s.h1}">Your 2-step verification was reset</h1>
<p style="${s.p}">Hi ${escapeHtml(target.full_name)}, an admin reset 2-step verification on your OnTrack account. Your old authenticator app entry and backup codes no longer work. You'll set it up again the next time you sign in.</p>
<p style="${s.small}">If you didn't ask for this, tell your admin right away.</p>`),
      text: `Hi ${target.full_name}, an admin reset 2-step verification on your OnTrack account. Your old authenticator app entry and backup codes no longer work. You'll set it up again the next time you sign in.\n\nIf you didn't ask for this, tell your admin right away.`,
    })
  } catch (e) {
    console.error(e)
    emailed = false
  }
  return json({ ok: true, emailed })
})
