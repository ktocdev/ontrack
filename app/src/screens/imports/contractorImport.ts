/**
 * Import contractors' rules (OT-151; Import-Contractors-*): the fields and the names a
 * sheet uses for them, the template, the problems the review asks about, and the rows
 * import_contractors takes (OT-149). It follows Add contractor: a new contractor needs a
 * company, a trade, a contact and a phone, and its email must be an address. A contractor
 * already in OnTrack (the same name, ignoring case and spaces) is skipped or updated, and an
 * update needs only what it changes. A trade the list doesn't have is matched to one that
 * exists, or added as a new trade in the same step.
 */
import type { FieldSpec } from '../../lib/import/columns'
import { contractorDuplicates } from '../../lib/import/duplicates'
import { exactOption, unmatchedValues } from '../../lib/import/match'
import { looksLikeEmail, looksLikePhone, parseDay, parseYes, splitList } from '../../lib/import/values'
import { whoLine, type Issue, type Resolutions, type RowState } from './review'

export type ContractorField = 'name' | 'trades' | 'contact' | 'phone' | 'email' | 'insurance' | 'preferred' | 'notes'

export const CONTRACTOR_FIELDS: FieldSpec<ContractorField>[] = [
  {
    key: 'name',
    title: 'Company',
    aliases: ['Company name', 'Vendor', 'Vendor name', 'Contractor', 'Business', 'Name'],
    required: true,
  },
  { key: 'trades', title: 'Trade', aliases: ['Trades', 'Type', 'Service', 'Services', 'Specialty'], required: true },
  { key: 'contact', title: 'Contact name', aliases: ['Contact', 'Contact person', 'Rep'], required: true },
  {
    key: 'phone',
    title: 'Phone',
    aliases: ['Phone number', 'Cell', 'Mobile', 'Tel', 'Telephone'],
    required: true,
    looksLike: looksLikePhone,
  },
  { key: 'email', title: 'Email', aliases: ['E-mail', 'Email address'], looksLike: looksLikeEmail },
  {
    key: 'insurance',
    title: 'Insurance expires',
    aliases: ['Insurance', 'Insurance expiry', 'Insurance expiration', 'COI expires', 'COI'],
  },
  { key: 'preferred', title: 'Preferred', aliases: ['Preferred contractor'] },
  { key: 'notes', title: 'Notes', aliases: ['Note', 'Comments'] },
]

/** The template: the fields' titles, one row, nothing else. */
export const CONTRACTOR_TEMPLATE = [CONTRACTOR_FIELDS.map((f) => f.title)]

/** Under a field that isn't in the sheet (the board's note). */
export const CONTRACTOR_LATER: Partial<Record<ContractorField, string>> = {
  preferred: 'Not in your sheet. You can mark preferred contractors after importing.',
  insurance: 'Not in your sheet. You can add insurance dates per contractor later.',
}

export type Trade = { id: string; name: string; active: boolean }
type Rec = { row: number; values: Record<ContractorField, string> }

/** A pick of "new:Glass" adds Glass as a trade with the import. */
export const NEW_TRADE = 'new:'
export const pickedTrade = (v: string) => (v.startsWith(NEW_TRADE) ? v.slice(NEW_TRADE.length) : v)

/** What the review asks about, and the rows already in OnTrack. */
export function contractorReview(
  records: Rec[],
  mapped: Set<ContractorField>,
  trades: Trade[],
  existing: { id: string; name: string }[],
) {
  const active = trades.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))
  const named = records.map((r) => ({ row: r.row, name: r.values.name }))
  const { matches, twice } = contractorDuplicates(named, existing)
  const duplicates = new Map(matches.map((m) => [m.row.row, m.existing.name]))
  const label = (r: Rec) => r.values.name || 'No company'
  const issues: Issue<ContractorField>[] = []

  // A trade the list doesn't have (or has turned off), for every row that names it.
  for (const g of unmatchedValues(records, (r) => splitList(r.values.trades), active)) {
    const offTrade = trades.find((t) => !t.active && exactOption(g.value, [t]))
    issues.push({
      id: `trade:${g.value.toLowerCase()}`,
      field: 'trades',
      kind: 'pick',
      title: offTrade ? `“${g.value}” is turned off` : `“${g.value}” isn’t a trade`,
      who: whoLine(g.rows.map((r) => ({ row: r.row, label: label(r) }))),
      rows: g.rows.map((r) => r.row),
      options: [
        ...active.map((t) => ({ value: t.name, label: t.name })),
        ...(offTrade ? [] : [{ value: `${NEW_TRADE}${g.value}`, label: `Add “${g.value}” as a new trade` }]),
      ],
      pickLabel: 'Choose a trade',
      initial: g.suggestion?.name ?? '',
      replaces: g.value,
      fixedText: (v) => (v.startsWith(NEW_TRADE) ? `Added ${pickedTrade(v)} as a trade` : `Set to ${v}`),
    })
  }

  for (const r of records) {
    const who = whoLine([{ row: r.row, label: label(r) }])
    const v = r.values
    const add = (issue: Omit<Issue<ContractorField>, 'rows' | 'who'>, line = who) =>
      issues.push({ ...issue, rows: [r.row], who: line })
    if (!v.name) {
      add({
        id: `name:${r.row}`,
        field: 'name',
        kind: 'input',
        title: 'Company is missing',
        placeholder: 'Company name',
        fixedText: (x) => `Named ${x}`,
      })
      continue
    }
    const first = twice.find((t) => t.row.row === r.row)?.first
    if (first) {
      add(
        {
          id: `twice:${r.row}`,
          field: 'name',
          kind: 'skip',
          title: `${v.name} is in the file twice`,
          fixedText: () => '',
        },
        `Row ${r.row} · also on row ${first.row}`,
      )
      continue
    }
    // An update needs only what it changes; a new contractor needs what Add contractor does.
    const isNew = !duplicates.has(r.row)
    if (isNew && splitList(v.trades).length === 0) {
      add({
        id: `trades:${r.row}`,
        field: 'trades',
        kind: 'pick',
        title: 'Trade is missing',
        options: active.map((t) => ({ value: t.name, label: t.name })),
        pickLabel: 'Choose a trade',
        fixedText: (x) => `Set to ${x}`,
      })
    }
    if (isNew && !v.contact) {
      add({
        id: `contact:${r.row}`,
        field: 'contact',
        kind: 'input',
        title: 'Contact is missing',
        placeholder: 'Contact name',
        fixedText: () => 'Contact added',
      })
    }
    if (isNew && !v.phone) {
      add({
        id: `phone:${r.row}`,
        field: 'phone',
        kind: 'input',
        inputType: 'tel',
        title: 'Phone is missing',
        placeholder: 'Phone number',
        fixedText: () => 'Phone added',
      })
    }
    if (v.email && !looksLikeEmail(v.email)) {
      add({
        id: `email:${r.row}`,
        field: 'email',
        kind: 'input',
        inputType: 'email',
        title: `“${v.email}” isn’t an email address`,
        initial: v.email,
        placeholder: 'name@company.com',
        fixedText: () => 'Email corrected',
      })
    }
    if (mapped.has('insurance') && parseDay(v.insurance, { endOfMonth: true }) === null) {
      add({
        id: `insurance:${r.row}`,
        field: 'insurance',
        kind: 'input',
        inputType: 'date',
        title: `“${v.insurance}” isn’t a date`,
        fixedText: (x) => `Insurance through ${x}`,
      })
    }
    if (mapped.has('preferred') && parseYes(v.preferred) === null) {
      add({
        id: `preferred:${r.row}`,
        field: 'preferred',
        kind: 'pick',
        title: `Preferred: “${v.preferred}” isn’t yes or no`,
        options: [
          { value: 'yes', label: 'Yes, preferred' },
          { value: 'no', label: 'No' },
        ],
        pickLabel: 'Choose',
        fixedText: (x) => (x === 'yes' ? 'Marked preferred' : 'Not preferred'),
      })
    }
  }

  return { issues, duplicates }
}

/** What import_contractors takes: the file's columns, the rows to send, and new trades. */
export function contractorPayload(
  records: Rec[],
  states: Map<number, RowState>,
  updates: Set<number>,
  mapped: Set<ContractorField>,
  resolutions: Resolutions,
) {
  const COLUMN: Record<ContractorField, string> = {
    name: 'name',
    trades: 'trades',
    contact: 'contact_name',
    phone: 'phone',
    email: 'email',
    insurance: 'insurance_until',
    preferred: 'preferred',
    notes: 'notes',
  }
  const columns = [...mapped].map((f) => COLUMN[f])
  if (!columns.includes('name')) columns.unshift('name')
  const newTrades = [
    ...new Set(
      Object.values(resolutions)
        .filter((r) => r?.status === 'fixed' && r.value.startsWith(NEW_TRADE))
        .map((r) => pickedTrade((r as { value: string }).value)),
    ),
  ]
  const rows = records
    .filter((r) => states.get(r.row) === 'ready' || (states.get(r.row) === 'duplicate' && updates.has(r.row)))
    .map((r) => {
      const v = r.values
      return {
        row: r.row,
        name: v.name,
        trades: splitList(v.trades),
        contact_name: v.contact,
        phone: v.phone,
        email: v.email,
        preferred: mapped.has('preferred') && v.preferred ? parseYes(v.preferred) : null,
        insurance_until: parseDay(v.insurance, { endOfMonth: true }) || null,
        notes: v.notes,
        on_duplicate: updates.has(r.row) ? 'update' : 'skip',
      }
    })
  return { columns, rows, newTrades }
}
