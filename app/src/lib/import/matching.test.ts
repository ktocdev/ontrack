import { describe, expect, it } from 'vitest'
import { guessColumns, readByColumns, sampleOf, splitSheet, unusedColumns, type FieldSpec } from './columns'
import { contractorDuplicates, equipmentDuplicates, importKey } from './duplicates'
import { closeness, exactOption, suggestOption, unmatchedValues } from './match'
import { looksLikeEmail, looksLikePhone, parseDay, parseYes, splitList } from './values'

const TRADES = ['Refrigeration', 'HVAC', 'Plumbing', 'Electrical', 'General repair', 'Audio & video'].map((name) => ({
  id: name,
  name,
}))
const RESTAURANTS = [
  { id: 'ls', name: 'Federale’s Logan Square' },
  { id: 'wl', name: 'Federale’s West Loop' },
  { id: 'po', name: 'Porter' },
  { id: 'rl', name: 'Ranalli’s Logan Square' },
]

describe('suggestions for a value that matches nothing', () => {
  it('reads the boards’ examples', () => {
    expect(suggestOption('Refrig.', TRADES)?.name).toBe('Refrigeration')
    expect(suggestOption('Federales LS', RESTAURANTS)?.name).toBe('Federale’s Logan Square')
    expect(suggestOption('Federales WL', RESTAURANTS)?.name).toBe('Federale’s West Loop')
    expect(suggestOption('Ranallis', RESTAURANTS)?.name).toBe('Ranalli’s Logan Square')
  })

  it('takes spelling slips and spacing', () => {
    expect(suggestOption('Plumbng', TRADES)?.name).toBe('Plumbing')
    expect(suggestOption('generalrepair', TRADES)?.name).toBe('General repair')
    expect(suggestOption('Audio and video', TRADES)?.name).toBe('Audio & video')
  })

  it('offers nothing when two are as likely, or nothing is close', () => {
    expect(suggestOption('Federales', RESTAURANTS)).toBeUndefined()
    expect(suggestOption('Juggling', TRADES)).toBeUndefined()
  })

  it('matches exactly, ignoring case, spaces and punctuation', () => {
    expect(exactOption('hvac', TRADES)?.id).toBe('HVAC')
    expect(exactOption('  Federales Logan Square ', RESTAURANTS)?.id).toBe('ls')
    expect(exactOption('Refrig.', TRADES)).toBeUndefined()
    expect(closeness('Porter', 'Porter')).toBe(1)
  })

  it('groups what matches nothing, most rows first, each with its rows', () => {
    const rows = [
      { row: 2, trade: 'Refrig.' },
      { row: 3, trade: 'HVAC' },
      { row: 4, trade: 'refrig.' },
      { row: 5, trade: 'Juggling' },
      { row: 6, trade: 'Refrig.' },
      { row: 7, trade: '' },
    ]
    const groups = unmatchedValues(rows, (r) => [r.trade], TRADES)
    expect(groups.map((g) => [g.value, g.rows.map((r) => r.row), g.suggestion?.name])).toEqual([
      ['Refrig.', [2, 4, 6], 'Refrigeration'],
      ['Juggling', [5], undefined],
    ])
  })
})

describe('cells as values', () => {
  it('reads the days a US sheet writes', () => {
    expect(parseDay('2027-06-30')).toBe('2027-06-30')
    expect(parseDay('6/30/2027')).toBe('2027-06-30')
    expect(parseDay('6/30/27')).toBe('2027-06-30')
    expect(parseDay('Jun 30, 2027')).toBe('2027-06-30')
    expect(parseDay('June 30 2027')).toBe('2027-06-30')
    expect(parseDay('3/2022')).toBe('2022-03-01')
    expect(parseDay('Jun 2027', { endOfMonth: true })).toBe('2027-06-30')
    expect(parseDay('2/2028', { endOfMonth: true })).toBe('2028-02-29')
    expect(parseDay('')).toBe('')
    expect(parseDay('2/30/2027')).toBeNull()
    expect(parseDay('someday')).toBeNull()
  })

  it('reads yes and no', () => {
    expect(['Yes', 'x', '✓', '1', 'TRUE'].map(parseYes)).toEqual([true, true, true, true, true])
    expect(['No', '', 'n', '0'].map(parseYes)).toEqual([false, false, false, false])
    expect(parseYes('maybe')).toBeNull()
  })

  it('splits a cell with several trades, keeping "&"', () => {
    expect(splitList('Refrigeration / HVAC')).toEqual(['Refrigeration', 'HVAC'])
    expect(splitList('Plumbing, Audio & video;')).toEqual(['Plumbing', 'Audio & video'])
  })

  it('knows an email and a phone when it sees one', () => {
    expect(looksLikeEmail('rosa@coldlinerefrigeration.com')).toBe(true)
    expect(looksLikeEmail('rosa at coldline')).toBe(false)
    expect(looksLikePhone('(312) 555-0187')).toBe(true)
    expect(looksLikePhone('+1 312.555.0187 x2')).toBe(true)
    expect(looksLikePhone('FC-2210')).toBe(false)
  })
})

type K = 'name' | 'trades' | 'contact' | 'phone' | 'email' | 'insurance' | 'preferred' | 'notes'
const FIELDS: FieldSpec<K>[] = [
  { key: 'name', title: 'Company', aliases: ['Vendor', 'Contractor', 'Name'], required: true },
  { key: 'trades', title: 'Trade', aliases: ['Type', 'Trades'], required: true },
  { key: 'contact', title: 'Contact name', aliases: ['Contact'] },
  { key: 'phone', title: 'Phone', aliases: ['Cell', 'Mobile'], required: true, looksLike: looksLikePhone },
  { key: 'email', title: 'Email', aliases: ['E-mail'], looksLike: looksLikeEmail },
  { key: 'insurance', title: 'Insurance expires', looksLike: (v) => !!parseDay(v) },
  { key: 'preferred', title: 'Preferred' },
  { key: 'notes', title: 'Notes' },
]

describe('matching columns', () => {
  // The board's sheet: Vendors 2026.xlsx, with a title row above the header and a blank row.
  const sheet = splitSheet([
    ['', '', ''],
    ['Vendor', 'Type', 'Contact', 'Cell', 'Reach at', 'Ins. exp', 'Notes', 'Acct #'],
    [
      'Coldline Refrigeration',
      'Refrigeration',
      'Rosa Alvarez',
      '(312) 555-0187',
      'rosa@coldline.com',
      '6/30/2027',
      '',
      'FC-2210',
    ],
    ['', '', '', '', '', '', '', ''],
    ['Northstar HVAC', 'HVAC', 'Kevin Brooks', '(312) 555-0162', 'kevin@northstar.com', '', 'Nights too', 'NS-1'],
  ])

  it('splits at the header and keeps each row’s number as the sheet shows it', () => {
    expect(sheet.header[0]).toBe('Vendor')
    expect(sheet.body.map((r) => r.row)).toEqual([3, 5])
  })

  it('matches by title and other names, and suggests by a close title or by the values', () => {
    const g = Object.fromEntries(guessColumns(sheet, FIELDS).map((x) => [x.key, x]))
    expect(g.name).toMatchObject({ column: 0, suggestion: null })
    expect(g.trades).toMatchObject({ column: 1 })
    expect(g.contact).toMatchObject({ column: 2 })
    expect(g.phone).toMatchObject({ column: 3 })
    expect(g.notes).toMatchObject({ column: 6 })
    // "Reach at" holds addresses; "Ins. exp" is a close title.
    expect(g.email).toMatchObject({ column: null, suggestion: 4 })
    expect(g.insurance).toMatchObject({ column: null, suggestion: 5 })
    expect(g.preferred).toMatchObject({ column: null, suggestion: null })
  })

  it('lists the columns nothing uses, and reads rows by the columns chosen', () => {
    const chosen = { name: 0, trades: 1, contact: 2, phone: 3, email: 4, insurance: 5, preferred: null, notes: 6 }
    expect(unusedColumns(sheet, Object.values(chosen)).map((c) => c.title)).toEqual(['Acct #'])
    expect(sampleOf(sheet, 6)).toBe('Nights too')
    const [first] = readByColumns(sheet, chosen)
    expect(first).toEqual({
      row: 3,
      values: {
        name: 'Coldline Refrigeration',
        trades: 'Refrigeration',
        contact: 'Rosa Alvarez',
        phone: '(312) 555-0187',
        email: 'rosa@coldline.com',
        insurance: '6/30/2027',
        preferred: '',
        notes: '',
      },
    })
  })
})

describe('duplicates', () => {
  it('match a contractor by name, ignoring case and spaces, and find one named twice', () => {
    const rows = [
      { row: 2, name: 'coldline  refrigeration' },
      { row: 3, name: 'Arctic Air' },
      { row: 4, name: 'Arctic air' },
    ]
    const { matches, twice } = contractorDuplicates(rows, [{ name: 'Coldline Refrigeration' }])
    expect(matches.map((m) => m.row.row)).toEqual([2])
    expect(twice.map((t) => [t.row.row, t.first.row])).toEqual([[4, 3]])
    expect(importKey(' Arctic  Air ')).toBe('arcticair')
  })

  it('match a unit by name or serial at the same restaurant, never a retired one', () => {
    const existing = [
      { name: 'Walk-in Cooler 1', serial: 'KP-7XW-220418', restaurant_id: 'ls' },
      { name: 'Ice Machine', serial: null, restaurant_id: 'po' },
      { name: 'Old Fryer', serial: 'F-1', restaurant_id: 'ls', retired_at: '2026-01-01' },
    ]
    const rows = [
      { row: 2, name: 'Cooler (walk-in)', serial: 'kp-7xw-220418', restaurantId: 'ls' },
      { row: 3, name: 'ice machine', serial: '', restaurantId: 'po' },
      { row: 4, name: 'Ice Machine', serial: '', restaurantId: 'ls' },
      { row: 5, name: 'Old Fryer', serial: 'F-1', restaurantId: 'ls' },
      { row: 6, name: 'Combi Oven', serial: 'R-9', restaurantId: 'ls' },
      { row: 7, name: 'Combi oven 2', serial: 'R-9', restaurantId: 'ls' },
      { row: 8, name: 'Mystery', serial: '', restaurantId: null },
    ]
    const { matches, twice } = equipmentDuplicates(rows, existing)
    expect(matches.map((m) => [m.row.row, m.by])).toEqual([
      [2, 'serial'],
      [3, 'name'],
    ])
    expect(twice.map((t) => [t.row.row, t.first.row])).toEqual([[7, 6]])
  })
})

// The same examples are pinned on the database's import_key() in 67_phase7_audit.test.sql
// (OT-154), so the review and the import can't drift apart on what counts as a duplicate.
describe('importKey matches the database', () => {
  it.each([
    ['Coldline  Refrigeration', 'coldlinerefrigeration'],
    ['Coldline\tRefrigeration', 'coldlinerefrigeration'],
    ['Cold line', 'coldline'],
    ['ÉCLAIR Bakery', 'éclairbakery'],
    ['Cold-line', 'cold-line'],
    ['Ice Machine 2', 'icemachine2'],
  ])('%j is %j', (value, key) => {
    expect(importKey(value)).toBe(key)
  })
})
