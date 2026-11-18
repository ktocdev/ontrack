import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'
import { diffByKey, readTable } from './table'

describe('CSV', () => {
  it('reads quotes, commas, line breaks, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,"two\nlines",\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'two\nlines', ''],
    ])
  })
  it('writes what it reads back, and never a formula', () => {
    const rows = [
      ['Section', 'Item'],
      ['Kitchen', '=HYPERLINK("x")'],
      ['Bar', 'a, "b"'],
    ]
    const out = toCsv(rows)
    expect(out).toContain(`"'=HYPERLINK(""x"")"`)
    expect(parseCsv(out)).toEqual(rows)
  })
})

describe('a table', () => {
  const columns = [
    { key: 'section' as const, title: 'Section', required: true },
    { key: 'item' as const, title: 'Item', aliases: ['Check'], required: true },
    { key: 'video' as const, title: 'Video link' },
  ]
  it('finds the header, matches titles loosely, skips blank rows and keeps row numbers', () => {
    const t = readTable(
      [[''], ['SECTION', ' check ', 'Notes'], ['Kitchen', 'Outlets', 'x'], ['', ''], ['Bar', 'Taps', '']],
      columns,
    )
    expect(t.missing).toEqual([])
    expect(t.unknown).toEqual(['Notes'])
    expect(t.records).toEqual([
      { row: 3, values: { section: 'Kitchen', item: 'Outlets', video: '' } },
      { row: 5, values: { section: 'Bar', item: 'Taps', video: '' } },
    ])
  })
  it('says which required columns are missing', () => {
    expect(readTable([['Section']], columns).missing).toEqual(['Item'])
  })
})

describe('a diff by key', () => {
  it('sorts what comes in against what is there', () => {
    const d = diffByKey(
      [
        { k: 'a', v: 1 },
        { k: 'b', v: 2 },
        { k: 'c', v: 3 },
      ],
      [
        { k: 'a', v: 1 },
        { k: 'b', v: 5 },
        { k: 'd', v: 4 },
      ],
      (x) => x.k,
      (x) => x.k,
      (a, b) => a.v === b.v,
    )
    expect(d.unchanged.map((x) => x.k)).toEqual(['a'])
    expect(d.changed.map((x) => x.to.k)).toEqual(['b'])
    expect(d.added.map((x) => x.k)).toEqual(['d'])
    expect(d.removed.map((x) => x.k)).toEqual(['c'])
  })
})
