/**
 * How a walkthrough's in-house fix reads in its list (design/screens/WT-Fix, WT-Fix-All).
 */

/** "Oct walkthrough · BOH › Electrical › Outlets" without the month, which the header gives. */
export function whereFrom(originLabel: string | null) {
  if (!originLabel) return null
  return originLabel.replace(/^[A-Za-z]{3} walkthrough · /, '')
}

/** "Added today by Maya", or "Added Nov 6 by Maya" on another day. */
export function addedLine(createdAt: string, name: string | null | undefined, now = new Date()) {
  const then = new Date(createdAt)
  const day =
    then.toDateString() === now.toDateString()
      ? 'today'
      : then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const who = name?.trim().split(/\s+/)[0]
  return who ? `Added ${day} by ${who}` : `Added ${day}`
}
