/**
 * The walkthrough schedule (WT-Ops-Schedule, OT-133): which of a rotation's months falls on a
 * calendar month, and how its settings read. The database works out the same position in
 * rotation_template(), counting months from the rotation's start, round the cycle.
 */

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "A", "B", … for a position in the cycle. */
export function letterOf(position: number) {
  return String.fromCharCode(65 + position)
}

/** Which of the three tones a position takes: A, B, C, then round again. */
export function toneOf(position: number): 1 | 2 | 3 {
  return ((position % 3) + 1) as 1 | 2 | 3
}

/** The position that falls on a month (0 to 11) of a year, for a cycle of n from startsOn. */
export function positionFor(startsOn: string, n: number, year: number, month: number) {
  if (n <= 0) return null
  const [sy, sm] = startsOn.split('-').map(Number) as [number, number]
  const since = (year - sy) * 12 + month - (sm - 1)
  return ((since % n) + n) % n
}

/** "Logan Square, Porter and West Loop"; "no restaurants yet" for none. */
export function listNames(names: string[]) {
  if (names.length === 0) return 'no restaurants yet'
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function ordinal(n: number) {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${n % 10 > 3 ? 'th' : tail}`
}

/** "Last day of the month", or "The 15th". */
export function dueLabel(dueDay: number | null) {
  return dueDay == null ? 'Last day of the month' : `The ${ordinal(dueDay)}`
}

/** "7 and 2 days before", "1 day before and on the day", "None". */
export function remindersLabel(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => b - a)
  if (sorted.length === 0) return 'None'
  const before = sorted.filter((d) => d > 0)
  const parts: string[] = []
  if (before.length) {
    const last = before[before.length - 1]!
    parts.push(`${listNames(before.map(String))} ${last === 1 && before.length === 1 ? 'day' : 'days'} before`)
  }
  if (sorted.includes(0)) parts.push('on the day')
  return parts.join(' and ').replace(/^on/, 'On')
}

/** "7 zones · 24 items", as the board's Checklist items row reads. */
export function checklistSize(sections: number, items: number) {
  return `${sections} ${sections === 1 ? 'zone' : 'zones'} · ${items} ${items === 1 ? 'item' : 'items'}`
}
