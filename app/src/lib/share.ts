/**
 * A ticket's lasting link, from the current origin, since each group has its own address.
 * It names the ticket the way people say it (/t/OT-1042), so it can be read out and typed.
 * The link grants nothing: whoever opens it still has to be able to see the ticket.
 */
export function ticketLink(displayId: string) {
  return `${window.location.origin}/t/${displayId}`
}

/**
 * A unit's lasting link, /e/<id>, from the current origin: what Share link sends and what
 * QR labels will encode (OT-74), so nothing printed later has to change. It grants nothing.
 */
export function equipmentLink(id: string) {
  return `${window.location.origin}/e/${id}`
}

/** A contractor's lasting link, /c/<id>, from the current origin (OT-95). It grants nothing. */
export function contractorLink(id: string) {
  return `${window.location.origin}/c/${id}`
}

/**
 * The ticket number in a typed link, forgiving of how a phone keyboard spells it: OT-0123,
 * ot-123, OT123 and 123 are all ticket 123. Anything else is not a number (an older link
 * carries the ticket's id).
 */
export function ticketNumber(param: string) {
  const match = /^(?:ot-?)?0*(\d{1,9})$/i.exec(param.trim())
  return match ? Number(match[1]) : null
}

/**
 * A phone gets its share sheet. A computer copies the link and says so, since a desktop
 * share sheet is rarely what someone wants. Cancelling the sheet is not a failure.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const phone = window.matchMedia?.('(pointer: coarse)').matches
  if (phone && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') return copy(url)
    }
    return 'shared'
  }
  return copy(url)
}

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    return 'copied' as const
  } catch {
    return 'failed' as const
  }
}
