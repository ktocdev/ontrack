import { describe, expect, it } from 'vitest'
import { countLabel, invoiceView, matchesInvoice, monthLabel, monthsOf, startMonth, type InvoiceRow } from './invoices'

const NOW = new Date(2026, 10, 12) // Nov 12, 2026
const r = (
  id: string,
  date: string,
  cents: number,
  { restaurant = 'logan', missing = false, who = 'Coldline Refrigeration', number = `INV-${id}` } = {},
): InvoiceRow => ({
  id,
  service_date: date,
  title: id,
  restaurant_id: restaurant,
  ticket: { display_id: `OT-${id}` },
  equipment: { name: 'Walk-in Cooler 1' },
  restaurant: { name: restaurant === 'porter' ? 'Porter' : 'Federale’s Logan Square', color: '#000' },
  contractor: { name: who },
  totalCents: cents,
  invoiceNumber: missing ? null : number,
  invoiceMissing: missing,
})

const rows = [
  r('1042', '2026-10-19', 39740),
  r('1028', '2026-10-15', 42000, { missing: true, who: 'Booth Doctor Upholstery' }),
  r('1023', '2026-10-11', 64000, { restaurant: 'porter', who: 'Hobart Service', number: 'H-20931' }),
  r('0951', '2026-09-09', 18600, { restaurant: 'porter', missing: true }),
]
const all = ['logan', 'porter']
const base = { restaurantIds: all, month: '2026-10', missingOnly: false, query: '', sort: 'new' as const }

describe('months', () => {
  it('offers the months with visits and this one, newest first', () => {
    expect(monthsOf(rows, all, NOW)).toEqual(['2026-11', '2026-10', '2026-09'])
    expect(monthsOf(rows, ['logan'], NOW)).toEqual(['2026-11', '2026-10'])
  })
  it('opens on the newest month with visits when this one has none', () => {
    expect(startMonth(rows, all, NOW)).toBe('2026-10')
    expect(startMonth([...rows, r('9', '2026-11-02', 100)], all, NOW)).toBe('2026-11')
    expect(startMonth([], all, NOW)).toBe('2026-11')
  })
  it('names a month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
    expect(monthLabel(null)).toBe('All months')
  })
})

describe('invoiceView', () => {
  it('lists the month at the restaurants picked, newest first, with the total and missing count', () => {
    const v = invoiceView(rows, base)
    expect(v.rows.map((x) => x.id)).toEqual(['1042', '1028', '1023'])
    expect(v.totalCents).toBe(39740 + 42000 + 64000)
    expect(v.missing).toBe(1)
  })
  it('narrows to a restaurant, to missing, or to every month', () => {
    expect(invoiceView(rows, { ...base, restaurantIds: ['porter'] }).rows.map((x) => x.id)).toEqual(['1023'])
    expect(invoiceView(rows, { ...base, missingOnly: true }).rows.map((x) => x.id)).toEqual(['1028'])
    const every = invoiceView(rows, { ...base, month: null })
    expect(every.rows).toHaveLength(4)
    expect(every.missing).toBe(2)
  })
  it('sorts oldest first or by amount', () => {
    expect(invoiceView(rows, { ...base, sort: 'old' }).rows.map((x) => x.id)).toEqual(['1023', '1028', '1042'])
    expect(invoiceView(rows, { ...base, sort: 'amount' }).rows.map((x) => x.id)).toEqual(['1023', '1028', '1042'])
  })
  it('keeps the missing count while a search narrows the rows', () => {
    const v = invoiceView(rows, { ...base, query: 'hobart' })
    expect(v.rows.map((x) => x.id)).toEqual(['1023'])
    expect(v.missing).toBe(1)
  })
})

describe('search and labels', () => {
  it('finds a contractor, unit, restaurant, ticket or invoice number', () => {
    const k = rows[2]!
    for (const q of ['HOBART', 'cooler', 'porter', '1023', 'ot-1023', 'h-209']) expect(matchesInvoice(k, q)).toBe(true)
    expect(matchesInvoice(k, 'roofing')).toBe(false)
  })
  it('counts invoices, saying match while narrowed', () => {
    expect(countLabel(8, false)).toBe('8 invoices')
    expect(countLabel(2, true)).toBe('2 invoices match')
    expect(countLabel(1, true)).toBe('1 invoice matches')
  })
})
