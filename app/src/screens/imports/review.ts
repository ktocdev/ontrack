/**
 * The review step's working-out, shared by every import (OT-151; equipment in OT-152):
 * problems found on the rows ("“Refrig.” isn’t a trade · 3 rows", "Phone is missing · row
 * 14"), each fixed once for all its rows or skipped, and what that leaves each row as:
 * ready, needing a fix (skipped if left), skipped, or already in OnTrack.
 */
import { splitList } from '../../lib/import/values'

export type Issue<F extends string> = {
  id: string
  field: F
  /** A choice from a list, a value to type, or only Skip (a row the file has twice). */
  kind: 'pick' | 'input' | 'skip'
  title: string
  /** Under the title: "3 rows · Arctic Air, Polar Service, Kold Kings" or "Brightway Glass · row 14". */
  who: string
  rows: number[]
  options?: { value: string; label: string }[]
  pickLabel?: string
  /** What the select starts on, or the field starts with. */
  initial?: string
  inputType?: 'text' | 'tel' | 'email' | 'date'
  placeholder?: string
  /** The value in a list cell this replaces ("Refrig." in "Refrig., HVAC"); otherwise the whole cell. */
  replaces?: string
  /** "Set to Refrigeration", "Phone added". */
  fixedText: (value: string) => string
}

export type Resolution = { status: 'fixed'; value: string } | { status: 'skipped' }

export type Resolutions = Record<string, Resolution | undefined>

export type RowState = 'ready' | 'fix' | 'skipped' | 'duplicate'

/** "Arctic Air, Polar Service, Kold Kings" with "and 4 more" past three. */
export function namesLine(names: string[]) {
  const shown = names.filter(Boolean).slice(0, 3)
  const more = names.filter(Boolean).length - shown.length
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ')
}

/** How undo names each kind of import's rows, and what keeps one (OT-153). */
export const UNDO_WORDS: Record<'contractors' | 'equipment', { one: string; many: string; history: string }> = {
  contractors: { one: 'contractor', many: 'contractors', history: 'visits on record' },
  equipment: { one: 'unit', many: 'units', history: 'tickets, service, tasks or files' },
}

/** "1 contractor", "40 units". */
export const importCount = (n: number, kind: 'contractors' | 'equipment') =>
  `${n} ${n === 1 ? UNDO_WORDS[kind].one : UNDO_WORDS[kind].many}`

/** "3 rows · Arctic Air, Polar Service, Kold Kings", or "Brightway Glass · row 14" for one. */
export function whoLine(rows: { row: number; label: string }[]) {
  if (rows.length === 1) return [rows[0]!.label, `row ${rows[0]!.row}`].filter(Boolean).join(' · ')
  return `${rows.length} rows · ${namesLine(rows.map((r) => r.label))}`
}

/** Each record with the fixes applied: a value swapped in a list cell, or the whole cell set. */
export function applyFixes<F extends string, R extends { row: number; values: Record<F, string> }>(
  records: R[],
  issues: Issue<F>[],
  resolutions: Resolutions,
  valueOf: (picked: string) => string = (v) => v,
) {
  const byRow = new Map(records.map((r) => [r.row, { ...r, values: { ...r.values } }]))
  for (const issue of issues) {
    const res = resolutions[issue.id]
    if (res?.status !== 'fixed') continue
    const value = valueOf(res.value)
    for (const n of issue.rows) {
      const r = byRow.get(n)
      if (!r) continue
      if (issue.replaces !== undefined) {
        const key = issue.replaces.trim().toLowerCase()
        r.values[issue.field] = splitList(r.values[issue.field])
          .map((v) => (v.trim().toLowerCase() === key ? value : v))
          .join(', ')
      } else r.values[issue.field] = value
    }
  }
  return records.map((r) => byRow.get(r.row)!)
}

/** Where each row stands: any problem skipped skips it, any still open needs a fix. */
export function rowStates<F extends string>(
  rows: number[],
  issues: Issue<F>[],
  resolutions: Resolutions,
  duplicates: Set<number>,
) {
  const state = new Map<number, RowState>(rows.map((n) => [n, duplicates.has(n) ? 'duplicate' : 'ready']))
  for (const issue of issues) {
    const res = resolutions[issue.id]
    for (const n of issue.rows) {
      if (res?.status === 'skipped') state.set(n, 'skipped')
      else if (!res && state.get(n) !== 'skipped') state.set(n, 'fix')
    }
  }
  return state
}

/** The review's three counts and the footer's. */
export function counts(states: Map<number, RowState>) {
  let ready = 0
  let fix = 0
  let duplicate = 0
  let skipped = 0
  for (const s of states.values()) {
    if (s === 'ready') ready++
    else if (s === 'fix') fix++
    else if (s === 'duplicate') duplicate++
    else skipped++
  }
  return { ready, fix, duplicate, skipped }
}
