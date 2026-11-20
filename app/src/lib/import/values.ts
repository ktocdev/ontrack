/**
 * A spreadsheet's cells as the values an import sends (OT-150): days, yes or no, a list of
 * names in one cell, an email address, a phone number. Each says null when the cell can't be
 * read as one, so the review can ask about that row.
 */

const pad = (n: number) => String(n).padStart(2, '0')

function day(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1) return null
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > last) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y)

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * A day as yyyy-mm-dd, from the ways a US sheet writes one: 2027-06-30, 6/30/2027, 6/30/27,
 * 6-30-2027, Jun 30 2027, June 30, 2027. A month alone (3/2022, Mar 2022) is its first day,
 * or its last when `endOfMonth` (an insurance or warranty "through" a month). Empty is ''.
 */
export function parseDay(text: string, { endOfMonth = false } = {}): string | null {
  const s = text.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!s) return ''
  const monthDay = (y: number, m: number) => day(y, m, endOfMonth ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 1)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return day(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s)
  if (m) return day(fullYear(+m[3]!), +m[1]!, +m[2]!)
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) return monthDay(+m[2]!, +m[1]!)
  m = /^([a-z]{3,9})\.? (\d{1,2}) (\d{4})$/.exec(s)
  if (m) {
    const month = MONTHS.indexOf(m[1]!.slice(0, 3)) + 1
    return month ? day(+m[3]!, month, +m[2]!) : null
  }
  m = /^([a-z]{3,9})\.? (\d{4})$/.exec(s)
  if (m) {
    const month = MONTHS.indexOf(m[1]!.slice(0, 3)) + 1
    return month ? monthDay(+m[2]!, month) : null
  }
  return null
}

const YES = new Set(['yes', 'y', 'true', 'x', '1', '✓', '✔', 'preferred'])
const NO = new Set(['no', 'n', 'false', '0', ''])

/** Yes or no from a cell ("Yes", "x", "✓", "1"); empty is no; anything else is null. */
export function parseYes(text: string): boolean | null {
  const s = text.trim().toLowerCase()
  if (YES.has(s)) return true
  if (NO.has(s)) return false
  return null
}

/**
 * Several names in one cell ("Refrigeration / HVAC", "Plumbing, Gas"): split at commas,
 * slashes, semicolons, bars and line breaks. "&" stays, since it is part of names like Audio & video.
 */
export function splitList(text: string) {
  return text
    .split(/[,;/|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The shape the database checks (contractors_email_shape), so the review catches it first. */
export const EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

export const looksLikeEmail = (s: string) => EMAIL.test(s.trim())

/** Seven or more digits, with the usual punctuation: (312) 555-0187, 312.555.0187, +1 312 555 0187 x2. */
export const looksLikePhone = (s: string) => /^[+()\d\s.\-x#ext]+$/i.test(s.trim()) && s.replace(/\D/g, '').length >= 7

export const looksLikeDay = (s: string) => !!parseDay(s)
