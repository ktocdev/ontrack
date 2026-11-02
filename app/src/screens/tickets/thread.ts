import { statusLabel } from '../../components/Pill'
import type { TicketStatus } from '../../lib/supabase'
import { ago } from './tickets'

/**
 * Turns a ticket's updates into what the thread shows. System events become one
 * line each, and someone taking a ticket and a status change made together become one line,
 * as on the board. A closing comment or a reopen reason is the event's line and then
 * a message, since a person wrote it.
 */

export type Update = {
  id: string
  kind: 'message' | 'created' | 'assigned' | 'status_changed' | 'closed' | 'reopened'
  body: string | null
  meta: unknown
  created_at: string
  author: { id: string; full_name: string; role: Author['role']; avatar_path: string | null } | null
}

type Author = { role: 'manager' | 'ops' | 'admin' | 'leadership' }

export type ThreadItem =
  | { type: 'event'; key: string; text: string; when: string }
  | {
      type: 'message'
      key: string
      /** The update it came from, which its photos hang on. */
      updateId: string
      who: string
      when: string
      text: string
      mine: boolean
      name: string
      role: Author['role']
      avatarPath: string | null
    }

export const ROLE_WORD: Record<Author['role'], string> = {
  manager: 'Manager',
  ops: 'Ops',
  admin: 'Admin',
  leadership: 'Leadership',
}

/** Who assigned updates point at, so their names can be read. */
export function assigneeIds(updates: Pick<Update, 'kind' | 'meta'>[]) {
  return [
    ...new Set(
      updates
        .filter((u) => u.kind === 'assigned')
        .map((u) => metaOf(u).to)
        .filter(Boolean),
    ),
  ]
}

function metaOf(u: Pick<Update, 'meta'>) {
  return (u.meta ?? {}) as { to?: string | null }
}

function statusWord(u: Update) {
  const to = metaOf(u).to as TicketStatus | undefined
  return to ? statusLabel(to) : 'changed'
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const sameMinute = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60_000

function clock(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The date once per day, then only the time: "Oct 19, 2026, 9:12 AM", "9:40 AM". */
function eventTime(d: Date, previous: Date | null) {
  if (previous && sameDay(previous, d)) return clock(d)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date}, ${clock(d)}`
}

export function threadItems(updates: Update[], me: string, names: Map<string, string>, now = new Date()): ThreadItem[] {
  const items: ThreadItem[] = []
  const isMe = (u: Update) => u.author?.id === me
  const by = (u: Update) => (isMe(u) ? 'you' : (u.author?.full_name ?? 'someone'))
  let lastEvent: Date | null = null

  const event = (key: string, text: string, at: string) => {
    const d = new Date(at)
    items.push({ type: 'event', key, text, when: eventTime(d, lastEvent) })
    lastEvent = d
  }
  const message = (u: Update) => {
    const mine = isMe(u)
    const name = u.author?.full_name ?? 'Someone'
    const when = ago(new Date(u.created_at), now)
    items.push({
      type: 'message',
      key: `${u.id}-message`,
      updateId: u.id,
      who: mine ? 'You' : u.author ? `${name}, ${ROLE_WORD[u.author.role]}` : name,
      when: when === 'just now' ? 'Just now' : when,
      text: u.body ?? '',
      mine,
      name,
      role: u.author?.role ?? 'manager',
      avatarPath: u.author?.avatar_path ?? null,
    })
  }

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i]!
    const next = updates[i + 1]
    switch (u.kind) {
      case 'message':
        message(u)
        break
      case 'created':
        event(u.id, `Opened by ${by(u)}`, u.created_at)
        break
      case 'closed':
        event(u.id, `Closed by ${by(u)}`, u.created_at)
        if (u.body) message(u)
        break
      case 'reopened':
        event(u.id, `Reopened by ${by(u)}`, u.created_at)
        if (u.body) message(u)
        break
      case 'assigned':
      case 'status_changed': {
        const other = u.kind === 'assigned' ? 'status_changed' : 'assigned'
        const together =
          next && next.kind === other && next.author?.id === u.author?.id && sameMinute(u.created_at, next.created_at)
        const assigned = u.kind === 'assigned' ? u : together ? next : null
        const status = u.kind === 'status_changed' ? u : together ? next : null
        const to = assigned && metaOf(assigned).to
        const who = assigned && (to ? (to === me ? 'You' : (names.get(to) ?? 'Someone')) : null)
        const parts = [
          assigned && (who ? `${who} took this` : 'Nobody on this now'),
          status && (assigned ? `status ${statusWord(status)}` : `Status ${statusWord(status)}`),
        ].filter(Boolean)
        event(u.id, parts.join(' · '), u.created_at)
        if (status?.body) message(status)
        if (together) i++
        break
      }
    }
  }
  return items
}
