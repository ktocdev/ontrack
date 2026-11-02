/**
 * A ticket's lasting link, from the current origin, since each group has its own address.
 * The link grants nothing: whoever opens it still has to be able to see the ticket.
 */
export function ticketLink(id: string) {
  return `${window.location.origin}/t/${id}`
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
