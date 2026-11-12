/**
 * Log service & cost: the parts with no screen in them, so Vitest can check them.
 */

/** The database refuses any single amount over this ($1,000,000). */
export const MAX_CENTS = 100_000_000

/**
 * What someone typed in a money field, in cents: "$1,212.40", "212.4", "65" and "" (zero)
 * all read; anything else, a third decimal or more than the cap is null.
 */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[\s$,]/g, '')
  if (t === '') return 0
  if (!/^\d*(\.\d{0,2})?$/.test(t) || t === '.') return null
  const [whole = '', frac = ''] = t.split('.')
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'))
  return cents > MAX_CENTS ? null : cents
}

/** A money field as it reads once you leave it: "120" becomes "$120.00"; an empty one stays empty. */
export function tidyMoney(text: string): string {
  const cents = parseMoney(text)
  if (cents === null || text.trim() === '') return text
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** The save button, from where the visit will land, as the board's "Save to ticket & equipment". */
export function saveLabel(onTicket: boolean, onUnit: boolean, saving: boolean) {
  const where = onTicket && onUnit ? ' to ticket & equipment' : onTicket ? ' to ticket' : onUnit ? ' to equipment' : ''
  if (saving) return `Saving${where}…`
  return where ? `Save${where}` : 'Save service'
}

/** The invoices bucket's limit and types: a PDF, or a photo of a paper invoice. */
export const INVOICE_MAX_BYTES = 25 * 1024 * 1024
export const INVOICE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

export function invoiceFileProblem(file: { type: string; size: number }): string | null {
  const image = file.type.startsWith('image/')
  if (file.type !== 'application/pdf' && !image) return 'An invoice has to be a PDF or a photo.'
  if (!image && file.size > INVOICE_MAX_BYTES) return 'That PDF is over 25 MB.'
  return null
}

/** A file's name as storage keeps it, under the record's folder. */
export function invoiceFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || 'invoice.pdf'
}

/**
 * "Oct 19, 2026" for a date column ("2026-10-19"), read as a calendar day, not a UTC
 * instant. Short leaves off this year's year ("Oct 19").
 */
export function serviceDay(date: string, short = false, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const year = short && y === now.getFullYear() ? undefined : 'numeric'
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year })
}

/** Today as a date field holds it, in the phone's own time zone. */
export function todayISO(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
