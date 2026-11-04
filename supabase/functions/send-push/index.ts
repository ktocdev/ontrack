import { emailFrame, emailStyles as s, sendEmail } from '../_shared/email.ts'
import { escapeHtml, json, refuse, serve, service } from '../_shared/http.ts'
import { pushServer, sendPush } from '../_shared/push.ts'

/**
 * Delivers whatever is waiting in the notifications outbox, when the database calls. It runs
 * with the service key and acts on nobody's behalf, so the only check is the shared secret,
 * and it takes nothing from the request: who gets what comes from notification_recipients,
 * and the words from the tables. Knowing the secret can only make it send sooner.
 * It still reports each delivery when a push service or email fails, and carries on.
 */

const DAY = 24 * 60 * 60 * 1000
const BATCH = 20
const MAX_BATCHES = 5

const STATUS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_parts: 'Waiting on parts',
  scheduled: 'Scheduled',
  reopened: 'Reopened',
  closed: 'Closed',
}

type Row = {
  id: string
  ticket_id: string
  kind: 'new_ticket' | 'reopened' | 'status_change' | 'update'
  actor_id: string | null
  body: string | null
  internal: boolean
  status_to: string | null
  picked_up: boolean
  created_at: string
}

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

/** What a notification says. A photo with no words still needs saying. */
function describe(n: Row, ticketLabel: string, restaurant: string, actor: string) {
  const words = n.body?.trim() || null
  switch (n.kind) {
    case 'new_ticket':
      return { headline: `New ticket at ${restaurant}`, line: ticketLabel, words }
    case 'reopened':
      return { headline: `Reopened at ${restaurant}`, line: ticketLabel, words }
    case 'status_change':
      return {
        headline: n.status_to ? `${STATUS[n.status_to] ?? 'Status changed'} · ${restaurant}` : `Picked up · ${restaurant}`,
        line: ticketLabel,
        words,
      }
    case 'update':
      return {
        headline: `${n.internal ? 'Internal note' : 'Update'} from ${actor}`,
        line: ticketLabel,
        words: words ?? 'Sent a photo.',
      }
  }
}

serve(async (req) => {
  const secret = Deno.env.get('SEND_PUSH_SECRET')
  const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!secret || !token || !sameSecret(token, secret)) return refuse('not_allowed', 401)

  const db = service()
  const server = await pushServer()
  const appUrl = Deno.env.get('APP_URL')!
  let handled = 0

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: BATCH })
    if (error) throw error
    if (!rows?.length) break

    for (const n of rows as Row[]) {
      handled++
      // Rows that waited this long were waiting for setup, and are no longer news.
      if (Date.now() - new Date(n.created_at).getTime() > DAY) continue
      try {
        await deliver(db, server, appUrl, n)
      } catch (e) {
        // One notification's trouble doesn't stop the others.
        console.error('notification not delivered', n.id, e)
      }
    }
    if (rows.length < BATCH) break
  }
  return json({ ok: true, handled })
})

async function deliver(
  db: ReturnType<typeof service>,
  server: Awaited<ReturnType<typeof pushServer>>,
  appUrl: string,
  n: Row,
) {
  const { data: ticket, error: ticketError } = await db
    .from('tickets')
    .select('id, display_id, title, scheduled_for, restaurant:restaurants (name)')
    .eq('id', n.ticket_id)
    .single()
  if (ticketError) throw ticketError
  const { data: actor } = n.actor_id
    ? await db.from('profiles').select('full_name').eq('id', n.actor_id).maybeSingle()
    : { data: null }
  const { data: people, error: peopleError } = await db.rpc('notification_recipients', { p_notification: n.id })
  if (peopleError) throw peopleError

  const restaurant = (ticket.restaurant as unknown as { name: string } | null)?.name ?? ''
  const actorName = actor?.full_name ?? 'Someone'
  const ticketLabel = `${ticket.display_id} · ${ticket.title}`
  const said = describe(n, ticketLabel, restaurant, actorName)
  const date = n.status_to === 'scheduled' && ticket.scheduled_for ? ` for ${ticket.scheduled_for}` : ''
  const path = `/t/${ticket.display_id ?? ticket.id}`
  const link = `${appUrl.replace(/\/$/, '')}${path}`

  const log = (user_id: string, channel: 'push' | 'email', status: 'sent' | 'gone' | 'failed') =>
    db
      .from('notification_deliveries')
      .insert({ notification_id: n.id, user_id, ticket_id: n.ticket_id, kind: n.kind, channel, status })

  for (const person of people ?? []) {
    if (person.push && server) {
      const { data: devices, error } = await db
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', person.user_id)
      if (error) throw error
      for (const device of devices ?? []) {
        try {
          const result = await sendPush(server, device, {
            title: `${said.headline}${date}`,
            body: said.words ? `${said.line}\n${said.words}` : said.line,
            url: path,
          })
          if (result === 'gone') await db.from('push_subscriptions').delete().eq('endpoint', device.endpoint)
          await log(person.user_id, 'push', result)
        } catch (e) {
          console.error('push failed', n.id, e)
          await log(person.user_id, 'push', 'failed')
        }
      }
    }
    if (person.send_email) {
      try {
        await sendEmail({
          to: person.email,
          subject: `[${ticket.display_id}] ${said.headline}${date}`,
          html: emailFrame(`
<h1 style="${s.h1}">${escapeHtml(said.headline + date)}</h1>
<p style="${s.p}"><b>${escapeHtml(ticketLabel)}</b><br>${escapeHtml(restaurant)} · ${escapeHtml(actorName)}${n.internal ? ' · Ops only' : ''}</p>
${said.words ? `<p style="${s.p};white-space:pre-wrap">${escapeHtml(said.words)}</p>` : ''}
<a href="${link}" style="${s.button}">Open ticket</a>
<p style="${s.small}">You can change these under Notifications on your OnTrack profile.</p>`),
          text: [
            said.headline + date,
            ticketLabel,
            `${restaurant} · ${actorName}${n.internal ? ' · Ops only' : ''}`,
            said.words ?? '',
            link,
          ]
            .filter(Boolean)
            .join('\n\n'),
        })
        await log(person.user_id, 'email', 'sent')
      } catch (e) {
        console.error('email failed', n.id, e)
        await log(person.user_id, 'email', 'failed')
      }
    }
  }
}
