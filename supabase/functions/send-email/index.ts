import { emailFrame, emailStyles as s, sendEmail } from '../_shared/email.ts'
import { escapeHtml, getCaller, json, refuse, serve, service } from '../_shared/http.ts'

/**
 * Forwards support reports to the support inbox (SUPPORT_EMAIL). A report is
 * saved first and this is called after, so a failed send loses nothing: it stays
 * unsent and goes out with the next call. It takes no address or message from
 * the caller, so it cannot be used to send anyone anything else. Other emails
 * are sent by the functions that need them, through _shared/email.ts.
 */

serve(async (req) => {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  const { data: role, error: roleError } = await caller.db.rpc('my_role')
  if (roleError) throw roleError
  if (!role) return refuse('not_allowed', 403)

  const to = Deno.env.get('SUPPORT_EMAIL')
  if (!to) return json({ sent: 0 })

  const db = service()
  const { data: reports, error } = await db
    .from('support_reports')
    .select('id, case_no, user_id, body, page, app_version, user_agent, profiles (full_name, email)')
    .is('emailed_at', null)
    .order('created_at')
    .limit(20)
  if (error) throw error

  let sent = 0
  const e = escapeHtml
  for (const r of reports ?? []) {
    // Claim it first, so two calls at once cannot both send it.
    const { data: claimed, error: claimError } = await db
      .from('support_reports')
      .update({ emailed_at: new Date().toISOString() })
      .eq('id', r.id)
      .is('emailed_at', null)
      .select('id')
    if (claimError) throw claimError
    if (!claimed?.length) continue

    const who = r.profiles as unknown as { full_name: string; email: string } | null
    const from = who ? `${who.full_name} <${who.email}>` : 'Unknown'
    const facts = [`From: ${from}`, `Page: ${r.page ?? '-'}`, `Version: ${r.app_version ?? '-'}`, `Device: ${r.user_agent ?? '-'}`]
    try {
      await sendEmail({
        to,
        replyTo: who?.email,
        subject: `OnTrack report #${r.case_no}`,
        text: `${r.body}\n\n${facts.join('\n')}`,
        html: emailFrame(`
<h1 style="${s.h1}">Report #${r.case_no}</h1>
<p style="${s.p};white-space:pre-wrap">${e(r.body)}</p>
<p style="${s.small}">${facts.map(e).join('<br>')}</p>`),
      })
      sent++
    } catch (err) {
      console.error(err)
      await db.from('support_reports').update({ emailed_at: null }).eq('id', r.id)
      return refuse('email_failed', 502)
    }
  }
  return json({ sent })
})
