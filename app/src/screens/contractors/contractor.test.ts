import { describe, expect, it } from 'vitest'
import { insuranceLine, mailtoHref, monthEnd, monthOf, summarizeVisits, visitsLabel, type Visit } from './contractor'

const v = (id: string, date: string, restaurant: string, cents: number, missing = false): Visit => ({
  id,
  service_date: date,
  title: id,
  restaurant_id: restaurant,
  ticket: null,
  equipment: null,
  restaurant: null,
  totalCents: cents,
  invoiceNumber: missing ? null : `INV-${id}`,
  invoiceMissing: missing,
})

describe('summarizeVisits', () => {
  const all = [
    v('a', '2026-01-15', 'logan', 18000, true),
    v('b', '2026-10-19', 'logan', 39740),
    v('c', '2025-12-01', 'logan', 10000),
    v('d', '2026-09-09', 'porter', 18600),
  ]

  it('adds up this year at the restaurants picked, newest first', () => {
    const s = summarizeVisits(all, ['logan', 'porter'], 2026)
    expect(s.visits.map((x) => x.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(s.yearCents).toBe(39740 + 18600 + 18000)
    expect(s.yearVisits).toBe(3)
    expect(s.lastVisit).toBe('2026-10-19')
    expect(s.missing).toBe(1)
  })

  it('leaves out the other restaurants', () => {
    const s = summarizeVisits(all, ['porter'], 2026)
    expect(s.visits.map((x) => x.id)).toEqual(['d'])
    expect(s.yearCents).toBe(18600)
    expect(s.missing).toBe(0)
  })

  it('has nothing to add with no visits', () => {
    expect(summarizeVisits([], ['logan'], 2026)).toEqual({
      visits: [],
      yearCents: 0,
      yearVisits: 0,
      lastVisit: null,
      missing: 0,
    })
  })
})

describe('insurance and months', () => {
  const NOW = new Date(2026, 10, 12)
  it('says through a month, or expired once it has passed', () => {
    expect(insuranceLine('2027-06-30', NOW)).toBe('Through Jun 2027')
    expect(insuranceLine('2026-09-30', NOW)).toBe('Expired Sep 2026')
    expect(insuranceLine('2026-11-12', NOW)).toBe('Through Nov 2026')
  })
  it('turns a month into its last day and back', () => {
    expect(monthEnd('2027-06')).toBe('2027-06-30')
    expect(monthEnd('2028-02')).toBe('2028-02-29')
    expect(monthEnd('')).toBeNull()
    expect(monthOf('2027-06-30')).toBe('2027-06')
    expect(monthOf(null)).toBe('')
  })
  it('counts visits', () => {
    expect(visitsLabel(1)).toBe('1 visit')
    expect(visitsLabel(11)).toBe('11 visits')
  })
})

describe('the Email button', () => {
  it('links an ordinary address', () => {
    expect(mailtoHref('rosa@coldline.example.com')).toBe('mailto:rosa@coldline.example.com')
    expect(mailtoHref("o'brien+ap@service.hobart.example.co.uk")).toBe("mailto:o'brien+ap@service.hobart.example.co.uk")
  })

  it('links nothing that would add a CC, a subject or a second recipient', () => {
    for (const email of ['a@b.co?cc=x%40y.z', 'a@b.co?subject=hi&body=pay', 'a@b.co,x%40y.z', 'a@b.co%0Acc:x', 'a@b'])
      expect(mailtoHref(email)).toBeNull()
    expect(mailtoHref(null)).toBeNull()
  })
})
