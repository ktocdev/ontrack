/**
 * Match columns (OT-150; Import-Contractors-Map, Import-Equipment-Map): which column of
 * someone's sheet holds each field OnTrack imports. A column whose title is the field's, or
 * another name for it, is matched; one whose title is close ("Ins. exp" for Insurance
 * expires) or whose values look right (addresses in an Email field) is only suggested, for
 * the person to accept with one tap. Each column goes to one field at most. The rows are
 * then read by the columns chosen.
 */
import { closeness, words } from './match'

export type FieldSpec<K extends string> = {
  key: K
  title: string
  /** Other titles a sheet uses for it ("Vendor" for Company); these match outright. */
  aliases?: string[]
  required?: boolean
  /** Whether a cell looks like this field's value, to suggest a column by what is in it. */
  looksLike?: (value: string) => boolean
}

/** A field's column: matched (`column`), or only suggested (`suggestion`), or neither. */
export type ColumnGuess<K extends string> = { key: K; column: number | null; suggestion: number | null }

/** A sheet split at its header: the first row with anything in it. */
export type Sheet = { header: string[]; body: { row: number; cells: string[] }[] }

export function splitSheet(rows: string[][]): Sheet {
  const at = rows.findIndex((r) => r.some((c) => c.trim() !== ''))
  if (at < 0) return { header: [], body: [] }
  const width = Math.max(...rows.map((r) => r.length))
  const header = Array.from({ length: width }, (_, i) => (rows[at]![i] ?? '').trim())
  const body = rows
    .slice(at + 1)
    .map((cells, i) => ({ row: at + i + 2, cells: cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ''))
  return { header, body }
}

/** The first value in a column, for the board's "e.g. Coldline Refrigeration". */
export function sampleOf(sheet: Sheet, column: number | null) {
  if (column === null) return ''
  return sheet.body.find((r) => (r.cells[column] ?? '') !== '')?.cells[column] ?? ''
}

/** Close enough to suggest a column by its title. */
const TITLE_AT = 0.6
/** The share of a column's filled cells that must look right to suggest it by its values. */
const VALUES_AT = 0.8

function looksShare(sheet: Sheet, column: number, looksLike: (v: string) => boolean) {
  const filled = sheet.body.map((r) => r.cells[column] ?? '').filter(Boolean)
  if (filled.length === 0) return 0
  return filled.filter(looksLike).length / filled.length
}

export function guessColumns<K extends string>(sheet: Sheet, fields: FieldSpec<K>[]) {
  const taken = new Set<number>()
  const guesses = new Map<K, ColumnGuess<K>>(fields.map((f) => [f.key, { key: f.key, column: null, suggestion: null }]))
  const columns = sheet.header.map((h, i) => ({ title: h, i })).filter((c) => c.title !== '')

  // Matched: the title is the field's or another name for it.
  for (const f of fields) {
    const names = new Set([f.title, ...(f.aliases ?? [])].map((n) => words(n).replace(/ /g, '')))
    const c = columns.find((c) => !taken.has(c.i) && names.has(words(c.title).replace(/ /g, '')))
    if (c) {
      guesses.get(f.key)!.column = c.i
      taken.add(c.i)
    }
  }

  // Suggested: the best of what is left, by title, then by what the cells hold.
  const offers: { key: K; i: number; score: number }[] = []
  for (const f of fields) {
    if (guesses.get(f.key)!.column !== null) continue
    for (const c of columns) {
      if (taken.has(c.i)) continue
      const byTitle = Math.max(...[f.title, ...(f.aliases ?? [])].map((n) => closeness(c.title, n)))
      const byValues = f.looksLike ? looksShare(sheet, c.i, f.looksLike) : 0
      const score = byTitle >= TITLE_AT ? 1 + byTitle : byValues >= VALUES_AT ? byValues : 0
      if (score > 0) offers.push({ key: f.key, i: c.i, score })
    }
  }
  offers.sort((a, b) => b.score - a.score)
  for (const o of offers) {
    const g = guesses.get(o.key)!
    if (g.suggestion !== null || taken.has(o.i)) continue
    g.suggestion = o.i
    taken.add(o.i)
  }

  return fields.map((f) => guesses.get(f.key)!)
}

/** The columns no field uses: the board's "Not imported". */
export function unusedColumns(sheet: Sheet, chosen: (number | null)[]) {
  const used = new Set(chosen.filter((c): c is number => c !== null))
  return sheet.header.map((title, i) => ({ title, i })).filter((c) => c.title !== '' && !used.has(c.i))
}

/** Each row's values by the columns chosen, '' for a field with no column, with its row number. */
export function readByColumns<K extends string>(sheet: Sheet, chosen: Record<K, number | null>) {
  const keys = Object.keys(chosen) as K[]
  return sheet.body.map((r) => ({
    row: r.row,
    values: Object.fromEntries(keys.map((k) => [k, chosen[k] === null ? '' : (r.cells[chosen[k]!] ?? '')])) as Record<
      K,
      string
    >,
  }))
}
