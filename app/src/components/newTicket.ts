import { useEffect, useState } from 'react'

/**
 * A new ticket's card has a ring for its first 5 minutes (from feedback, no board).
 * It is worked out from `created_at`, so it shows on every device and survives a
 * reload with nothing stored, and opening the ticket doesn't take it off. A reopened
 * ticket keeps its old `created_at`, and gets no ring even within the 5 minutes.
 */
export const NEW_FOR_MS = 5 * 60_000

/** When the ring comes off, in ms since the epoch; 0 for a ticket that never has one. */
export function ringUntil(createdAt: string | undefined, status: string) {
  if (!createdAt || status === 'reopened') return 0
  return new Date(createdAt).getTime() + NEW_FOR_MS
}

/** Whether to ring the card now; a timer takes it off on time, since not every list rereads. */
export function useNewTicket(createdAt: string | undefined, status: string) {
  const until = ringUntil(createdAt, status)
  // The time as the card mounts, moved on by the timer below.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const left = until - Date.now()
    if (left <= 0) return
    const timer = window.setTimeout(() => setNow(Date.now()), left + 50)
    return () => window.clearTimeout(timer)
  }, [until])
  return until > now
}

/** The ring itself: 2px of brand around the card's border. */
export const NEW_RING = 'ring-2 ring-brand'
