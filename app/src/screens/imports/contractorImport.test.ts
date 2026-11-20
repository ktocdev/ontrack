import { describe, expect, it } from 'vitest'
import { contractorPayload, contractorReview, NEW_TRADE, pickedTrade, type ContractorField } from './contractorImport'
import { applyFixes, counts, rowStates, type Resolutions } from './review'

const TRADES = [
  { id: 'r', name: 'Refrigeration', active: true },
  { id: 'h', name: 'HVAC', active: true },
  { id: 'p', name: 'Plumbing', active: true },
  { id: 'o', name: 'Roofing', active: false },
]
const EXISTING = [{ id: 'c1', name: 'Coldline Refrigeration' }]

const rec = (row: number, v: Partial<Record<ContractorField, string>>) => ({
  row,
  values: { name: '', trades: '', contact: '', phone: '', email: '', insurance: '', preferred: '', notes: '', ...v },
})
const full = { contact: 'Al', phone: '(312) 555-0101' }

// The board's sheet: three "Refrig." rows, one with no phone, Coldline again, one ready.
const records = [
  rec(2, { name: 'Northstar HVAC', trades: 'HVAC', ...full }),
  rec(3, { name: 'coldline refrigeration', trades: 'Refrigeration', phone: '(312) 555-0000' }),
  rec(4, { name: 'Arctic Air', trades: 'Refrig.', ...full }),
  rec(5, { name: 'Polar Service', trades: 'refrig., HVAC', ...full }),
  rec(6, { name: 'Kold Kings', trades: 'Refrig.', ...full }),
  rec(14, { name: 'Brightway Glass', trades: 'Glass', contact: 'Tina' }),
  rec(15, { name: 'Arctic air', trades: 'HVAC', ...full }),
  rec(16, { name: 'Old Roofers', trades: 'Roofing', ...full, email: 'not an address', insurance: 'soon' }),
]
const mapped = new Set<ContractorField>(['name', 'trades', 'contact', 'phone', 'email', 'insurance'])

describe('the review of a contractor sheet', () => {
  const { issues, duplicates } = contractorReview(records, mapped, TRADES, EXISTING)
  const byId = Object.fromEntries(issues.map((i) => [i.id, i]))

  it('groups a trade the list doesn’t have, with a suggestion, and offers to add an unknown one', () => {
    const refrig = byId['trade:refrig.']!
    expect(refrig.title).toBe('“Refrig.” isn’t a trade')
    expect(refrig.who).toBe('3 rows · Arctic Air, Polar Service, Kold Kings')
    expect(refrig.initial).toBe('Refrigeration')
    const glass = byId['trade:glass']!
    expect(glass.options?.at(-1)).toEqual({ value: `${NEW_TRADE}Glass`, label: 'Add “Glass” as a new trade' })
  })

  it('says a turned-off trade is turned off, and doesn’t offer to add it again', () => {
    const off = byId['trade:roofing']!
    expect(off.title).toBe('“Roofing” is turned off')
    expect(off.options?.some((o) => o.value.startsWith(NEW_TRADE))).toBe(false)
  })

  it('asks a new contractor for what Add contractor needs, and an update for nothing more', () => {
    expect(byId['phone:14']).toMatchObject({ title: 'Phone is missing', who: 'Brightway Glass · row 14' })
    expect(byId['contact:3']).toBeUndefined()
    expect(duplicates.get(3)).toBe('Coldline Refrigeration')
  })

  it('catches a bad email, a date that isn’t one, and a row the file has twice', () => {
    expect(byId['email:16']?.title).toBe('“not an address” isn’t an email address')
    expect(byId['insurance:16']?.title).toBe('“soon” isn’t a date')
    expect(byId['twice:15']).toMatchObject({ kind: 'skip', who: 'Row 15 · also on row 4' })
  })

  it('counts and sends what is ready once fixed, skipped or updated', () => {
    const resolutions: Resolutions = {
      'trade:refrig.': { status: 'fixed', value: 'Refrigeration' },
      'trade:glass': { status: 'fixed', value: `${NEW_TRADE}Glass` },
      'phone:14': { status: 'fixed', value: '(312) 555-0102' },
      'trade:roofing': { status: 'skipped' },
    }
    const rows = records.map((r) => r.row)
    const fixed = applyFixes(records, issues, resolutions, pickedTrade)
    const states = rowStates(rows, issues, resolutions, new Set(duplicates.keys()))
    // Ready: 2, 4, 5, 6, 14. Duplicate: 3. Needs a fix: 15 (twice). Skipped: 16.
    expect(counts(states)).toEqual({ ready: 5, fix: 1, duplicate: 1, skipped: 1 })
    expect(fixed.find((r) => r.row === 5)!.values.trades).toBe('Refrigeration, HVAC')

    const payload = contractorPayload(fixed, states, new Set([3]), mapped, resolutions)
    expect(payload.newTrades).toEqual(['Glass'])
    expect(payload.columns).toEqual(['name', 'trades', 'contact_name', 'phone', 'email', 'insurance_until'])
    expect(payload.rows.map((r) => [r.row, r.on_duplicate])).toEqual([
      [2, 'skip'],
      [3, 'update'],
      [4, 'skip'],
      [5, 'skip'],
      [6, 'skip'],
      [14, 'skip'],
    ])
    expect(payload.rows.find((r) => r.row === 14)).toMatchObject({ trades: ['Glass'], phone: '(312) 555-0102' })
  })
})
