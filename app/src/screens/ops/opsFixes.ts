/**
 * How the Support Team's in-house lists word a fix (WT-Ops-Fix, OT-131): who fixed it and
 * when, who made it a ticket, and the line that confirms a conversion.
 */

const dayOf = (at: string, now: Date) => {
  const then = new Date(at)
  return then.toDateString() === now.toDateString()
    ? 'today'
    : then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const firstOf = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

/** "Fixed Oct 22 by Maya · added Oct 21", as the board's Fixed rows read. */
export function fixedLine(doneAt: string, doneBy: string | null | undefined, createdAt: string, now = new Date()) {
  const who = firstOf(doneBy)
  return `Fixed ${dayOf(doneAt, now)}${who ? ` by ${who}` : ''} · added ${dayOf(createdAt, now)}`
}

/** "Converted by you · Added Oct 23 by Maya", or by whoever on the Support Team did it. */
export function convertedLine(by: { id: string | null; name: string | null | undefined }, me: string, added: string) {
  const who = by.id === me ? 'you' : firstOf(by.name)
  return who ? `Converted by ${who} · ${added}` : `Converted · ${added}`
}

/** The line after Convert: "Converted to OT-1058. It's on your dashboard." */
export function convertedNotice(displayId: string | null) {
  return displayId
    ? `Converted to ${displayId}. It’s on your dashboard.`
    : 'Converted to a ticket. It’s on your dashboard.'
}
