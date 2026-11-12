import { describe, expect, it } from 'vitest'
import {
  invoiceFileName,
  invoiceFileProblem,
  MAX_CENTS,
  parseMoney,
  saveLabel,
  serviceDay,
  tidyMoney,
  todayISO,
} from './service'

describe('parseMoney', () => {
  it('reads the ways people type an amount', () => {
    expect(parseMoney('$120.00')).toBe(12000)
    expect(parseMoney('212.4')).toBe(21240)
    expect(parseMoney('65')).toBe(6500)
    expect(parseMoney('$1,212.40')).toBe(121240)
    expect(parseMoney(' .5 ')).toBe(50)
    expect(parseMoney('')).toBe(0)
  })
  it('refuses what is not an amount', () => {
    expect(parseMoney('12.345')).toBeNull()
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('.')).toBeNull()
    expect(parseMoney('1.2.3')).toBeNull()
  })
  it('stops at the database cap', () => {
    expect(parseMoney('1000000')).toBe(MAX_CENTS)
    expect(parseMoney('1000000.01')).toBeNull()
  })
})

describe('tidyMoney', () => {
  it('shows two decimals once you leave the field', () => {
    expect(tidyMoney('120')).toBe('$120.00')
    expect(tidyMoney('1212.4')).toBe('$1,212.40')
  })
  it('leaves an empty or unreadable field for the person to fix', () => {
    expect(tidyMoney('')).toBe('')
    expect(tidyMoney('12.345')).toBe('12.345')
  })
})

describe('saveLabel', () => {
  it('says where the visit lands, as the board does', () => {
    expect(saveLabel(true, true, false)).toBe('Save to ticket & equipment')
    expect(saveLabel(true, false, false)).toBe('Save to ticket')
    expect(saveLabel(false, true, false)).toBe('Save to equipment')
    expect(saveLabel(false, false, false)).toBe('Save service')
    expect(saveLabel(true, true, true)).toBe('Saving to ticket & equipment…')
  })
})

describe('invoice files', () => {
  it('takes a PDF or a photo', () => {
    expect(invoiceFileProblem({ type: 'application/pdf', size: 1000 })).toBeNull()
    expect(invoiceFileProblem({ type: 'image/heic', size: 40_000_000 })).toBeNull()
    expect(invoiceFileProblem({ type: 'text/plain', size: 10 })).toMatch(/PDF or a photo/)
    expect(invoiceFileProblem({ type: 'application/pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/)
  })
  it('keeps a safe name', () => {
    expect(invoiceFileName('Coldline INV#58213.pdf')).toBe('Coldline-INV-58213.pdf')
    expect(invoiceFileName('')).toBe('invoice.pdf')
  })
})

describe('dates', () => {
  it('reads a date column as a calendar day', () => {
    expect(serviceDay('2026-10-19')).toBe('Oct 19, 2026')
    expect(serviceDay('2026-10-19', true, new Date(2026, 10, 11))).toBe('Oct 19')
    expect(serviceDay('2025-10-19', true, new Date(2026, 10, 11))).toBe('Oct 19, 2025')
  })
  it('gives today in the phone’s time zone', () => {
    expect(todayISO(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
  })
})
