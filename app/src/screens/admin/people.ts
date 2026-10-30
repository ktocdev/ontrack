const DAY = 24 * 3600 * 1000

function ago(then: Date, now: Date) {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/** The status line on a pending row: "Invite pending · sent 2 days ago" or "Invite expired · Oct 10". */
export function inviteLine(invite: { sent_at: string; expires_at: string }, now = new Date()) {
  const expires = new Date(invite.expires_at)
  if (expires.getTime() <= now.getTime()) {
    return `Invite expired · ${expires.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return `Invite pending · sent ${ago(new Date(invite.sent_at), now)}`
}

/** Where someone works, as the rows show it: their restaurants, or all of them. */
export function scopeLine(role: string, names: string[] | null) {
  if (names === null) return role === 'leadership' ? 'All · read-only' : 'All restaurants'
  return names.length ? names.join(', ') : 'No restaurant yet'
}
