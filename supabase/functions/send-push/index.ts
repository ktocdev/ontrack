import { emailFrame, emailStyles as s, sendEmail } from '../_shared/email.ts'
import { escapeHtml, json, refuse, serve, service } from '../_shared/http.ts'
import { pushServer, sendPush } from '../_shared/push.ts'

/**
 * Delivers whatever is waiting in the notifications outbox, when the database calls. It runs
 * with the service key and acts on nobody's behalf, so the only check is the shared secret,
 * and it takes nothing from the request: who gets what comes from notification_recipients,
 * and the words from the tables. Knowing the secret can only make it send sooner.
 * It still reports each delivery when a push service or email fails, and carries on. A row is
 * about a ticket, or for a reminder (OT-103), a walkthrough.
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
  ticket_id: string | null
  walkthrough_id: string | null
  kind: 'new_ticket' | 'reopened' | 'status_change' | 'update' | 'walkthrough_reminder'
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
    case 'walkthrough_reminder':
      throw new Error('a reminder is not about a ticket')
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
        if (n.walkthrough_id) await deliverReminder(db, server, appUrl, n, n.walkthrough_id)
        else await deliver(db, server, appUrl, n)
      } catch (e) {
        // One notification's trouble doesn't stop the others.
        console.error('notification not delivered', n.id, e)
      }
    }
    if (rows.length < BATCH) break
  }
  return json({ ok: true, handled })
})


type Db = ReturnType<typeof service>
type Server = Awaited<ReturnType<typeof pushServer>>
type Person = { user_id: string; email: string; push: boolean; send_email: boolean }
type Message = { title: string; body: string; path: string; subject: string; html: string; text: string }

async function recipients(db: Db, n: Row) {
  const { data, error } = await db.rpc('notification_recipients', { p_notification: n.id })
  if (error) throw error
  return (data ?? []) as Person[]
}

/** Sends one message to each person by the ways they get it, and logs each. */
async function sendTo(db: Db, server: Server, n: Row, people: Person[], message: Message) {
  const log = (user_id: string, channel: 'push' | 'email', status: 'sent' | 'gone' | 'failed') =>
    db.from('notification_deliveries').insert({
      notification_id: n.id,
      user_id,
      ticket_id: n.ticket_id,
      walkthrough_id: n.walkthrough_id,
      kind: n.kind,
      channel,
      status,
    })

  for (const person of people) {
    if (person.push && server) {
      const { data: devices, error } = await db
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', person.user_id)
      if (error) throw error
      for (const device of devices ?? []) {
        try {
          const result = await sendPush(server, device, { title: message.title, body: message.body, url: message.path })
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
        await sendEmail({ to: person.email, subject: message.subject, html: message.html, text: message.text })
        await log(person.user_id, 'email', 'sent')
      } catch (e) {
        console.error('email failed', n.id, e)
        await log(person.user_id, 'email', 'failed')
      }
    }
  }
}

async function deliver(db: Db, server: Server, appUrl: string, n: Row) {
  const { data: ticket, error: ticketError } = await db
    .from('tickets')
    .select('id, display_id, title, scheduled_for, restaurant:restaurants (name)')
    .eq('id', n.ticket_id!)
    .single()
  if (ticketError) throw ticketError
  const { data: actor } = n.actor_id
    ? await db.from('profiles').select('full_name').eq('id', n.actor_id).maybeSingle()
    : { data: null }
  const people = await recipients(db, n)

  const restaurant = (ticket.restaurant as unknown as { name: string } | null)?.name ?? ''
  const actorName = actor?.full_name ?? 'Someone'
  const ticketLabel = `${ticket.display_id} · ${ticket.title}`
  const said = describe(n, ticketLabel, restaurant, actorName)
  const date = n.status_to === 'scheduled' && ticket.scheduled_for ? ` for ${ticket.scheduled_for}` : ''
  const path = `/t/${ticket.display_id ?? ticket.id}`
  const link = `${appUrl.replace(/\/$/, '')}${path}`

  await sendTo(db, server, n, people, {
    title: `${said.headline}${date}`,
    body: said.words ? `${said.line}\n${said.words}` : said.line,
    path,
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
}

/** A date column (YYYY-MM-DD) as a day count, so two can be subtracted. */
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY)

/** "due in 7 days", from the group's today, which is when the reminder is sent. */
function dueIn(dueOn: string, timeZone: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
  const days = dayNumber(dueOn) - dayNumber(today)
  if (days <= 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  return `due in ${days} days`
}

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })

/** A walkthrough's reminder: what is due, when, how far along it is, and a link to it. */
async function deliverReminder(db: Db, server: Server, appUrl: string, n: Row, walkthroughId: string) {
  const { data: walkthrough, error } = await db
    .from('walkthroughs')
    .select('id, period, due_on, restaurant:restaurants (name)')
    .eq('id', walkthroughId)
    .single()
  if (error) throw error
  const people = await recipients(db, n)
  if (!people.length) return

  const { data: settings } = await db.from('group_settings').select('time_zone').maybeSingle()
  const { data: sections } = await db
    .from('v_walkthrough_progress')
    .select('total, done')
    .eq('walkthrough_id', walkthroughId)
  const total = (sections ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
  const done = (sections ?? []).reduce((sum, r) => sum + (r.done ?? 0), 0)

  const restaurant = (walkthrough.restaurant as unknown as { name: string } | null)?.name ?? ''
  const month = dateLabel(walkthrough.period, { month: 'long' })
  const due = dueIn(walkthrough.due_on, settings?.time_zone ?? 'UTC')
  const headline = `${month} walkthrough ${due}`
  const when = `Due ${dateLabel(walkthrough.due_on, { weekday: 'short', month: 'short', day: 'numeric' })}`
  const progress = done === 0 ? 'Not started yet' : `${done} of ${total} checked`
  const path = '/walkthrough'
  const link = `${appUrl.replace(/\/$/, '')}${path}`

  await sendTo(db, server, n, people, {
    title: `${headline} · ${restaurant}`,
    body: `${when}\n${progress}`,
    path,
    subject: `${headline} · ${restaurant}`,
    html: emailFrame(`
<h1 style="${s.h1}">${escapeHtml(headline)}</h1>
<p style="${s.p}"><b>${escapeHtml(restaurant)}</b><br>${escapeHtml(when)} · ${escapeHtml(progress)}</p>
<a href="${link}" style="${s.button}">Open walkthrough</a>
<p style="${s.small}">You can change these under Notifications on your OnTrack profile.</p>`),
    text: [headline, restaurant, `${when} · ${progress}`, link].join('\n\n'),
  })
}
