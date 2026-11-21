import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { RowState } from './review'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { Segmented } from '../../components/Segmented'
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconFileUpload,
} from '../../components/icons'

/**
 * The import steps' pieces (Import-Contractors-*, Import-Equipment-*; OT-151, reused by
 * OT-152): the frame with its step line, title, back and close and the four-part progress;
 * choosing the file; a field matched to a column; the review's counts, problems, rows
 * already in OnTrack and ready rows; and the done step. Each is on /kit.
 */

/** The frame: "Step 2 of 3 · Contractors" over the title, Back from step 2, Close, then the bar. */
export function ImportFrame({
  step,
  label,
  title,
  onBack,
  closeTo,
  footer,
  table,
  children,
}: {
  /** The review table, on a laptop: the cards go in a column on the left and it fills the rest (OT-161). */
  table?: ReactNode
  /** 1 to 3, or 4 when done. */
  step: 1 | 2 | 3 | 4
  label: string
  title: string
  onBack?: () => void
  closeTo: string
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex flex-none flex-col gap-2.5 border-b border-border pb-3 pl-2 pr-3 pt-[calc(10px+var(--safe-top))]">
        <div className="flex items-center gap-1">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text hover:bg-surface-hover"
            >
              <IconChevronLeft size={22} />
            </button>
          ) : (
            <span className="w-3 flex-none" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-12 font-semibold text-text-secondary">
              {step < 4 ? `Step ${step} of 3 · ${label}` : label}
            </span>
            <h1 className="truncate font-display text-20 font-bold">{title}</h1>
          </div>
          <Link
            to={closeTo}
            aria-label={step < 4 ? 'Cancel import' : 'Close'}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text hover:bg-surface-hover"
          >
            <IconClose />
          </Link>
        </div>
        <div aria-hidden="true" className="flex gap-1 pl-3 pr-2">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-[2px] ${n <= step ? 'bg-brand-fill' : 'bg-border'}`} />
          ))}
        </div>
      </header>
      {table ? (
        <div className="flex min-h-0 flex-1 gap-6 px-screen py-4">
          <div className="-mx-1 flex w-[400px] flex-none flex-col gap-3 overflow-y-auto px-1">{children}</div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{table}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-screen py-4">{children}</div>
      )}
      <div className="flex flex-none flex-col border-t border-border bg-bg px-screen pb-[max(24px,var(--safe-bottom))] pt-3">
        <div className={`flex flex-col gap-2 ${table ? 'w-[400px]' : ''}`}>{footer}</div>
      </div>
    </div>
  )
}

/** Small print in the footer, over the button ("4 rows that still need a fix will be skipped."). */
export function FooterHint({ children }: { children: ReactNode }) {
  return <span className="text-center text-12 leading-[1.4] text-text-secondary">{children}</span>
}

/** The dashed box to pick a file, or the file picked with its counts and first rows. */
export function FileChoice({
  file,
  onChoose,
  onChange,
  reading,
}: {
  file: { name: string; rows: number; columns: number; firstRows: string[] } | null
  onChoose: () => void
  onChange: () => void
  reading?: boolean
}) {
  if (!file) {
    return (
      <button
        type="button"
        onClick={onChoose}
        disabled={reading}
        className="flex min-h-[168px] flex-none flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-border-muted bg-surface-sunken px-4 py-4 text-text hover:bg-surface-hover disabled:opacity-60"
      >
        <IconFileUpload size={30} className="text-brand" />
        <span className="text-16 font-bold">{reading ? 'Reading the sheet…' : 'Choose a spreadsheet'}</span>
        <span className="text-center text-13 leading-[1.4] text-text-secondary">
          Excel or CSV from Files, Google Drive
          <br />
          or an email attachment
        </span>
      </button>
    )
  }
  const ext = file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX'
  return (
    <>
      <div className="flex flex-none items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3">
        <span className="flex h-[52px] w-11 flex-none items-center justify-center rounded-[8px] bg-brand-tint text-11 font-bold text-brand-strong">
          {ext}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-15 font-semibold [overflow-wrap:anywhere]">{file.name}</span>
          <span className="text-12 text-text-secondary">
            {file.rows} {file.rows === 1 ? 'row' : 'rows'} · {file.columns} columns · first sheet
          </span>
        </div>
        <button type="button" onClick={onChange} className="min-h-10 flex-none px-1 text-14 font-semibold text-brand">
          Change
        </button>
      </div>
      {file.firstRows.length > 0 && (
        <div className="flex flex-none flex-col gap-1.5 rounded-card border border-border bg-surface px-4 py-3.5">
          <span className="eyebrow">First rows</span>
          <span className="text-13 leading-normal text-text-body">
            {file.firstRows.map((r, i) => (
              <span key={i} className="block [overflow-wrap:anywhere]">
                {r}
              </span>
            ))}
          </span>
        </div>
      )}
    </>
  )
}

/** "Starting from scratch? Download a sheet with the right columns." */
export function TemplateCard({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="flex flex-none items-center gap-3 rounded-card border border-border bg-surface px-4 py-3.5">
      <IconDownload size={22} className="flex-none text-brand" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold">Starting from scratch?</span>
        <span className="text-12 leading-[1.4] text-text-secondary">Download a sheet with the right columns.</span>
      </div>
      <button type="button" onClick={onDownload} className="min-h-10 flex-none px-1 text-14 font-semibold text-brand">
        Template
      </button>
    </div>
  )
}

/** One field on Match columns: matched or not, the column picked, its first value, a suggestion. */
export function MapField({
  title,
  required,
  column,
  columns,
  sample,
  suggestion,
  note,
  satisfied = false,
  onPick,
  children,
}: {
  title: string
  required?: boolean
  column: number | null
  columns: { title: string; i: number }[]
  sample?: string
  /** A column offered with one tap ("Use “Ins. exp”?"). */
  suggestion?: { title: string; i: number } | null
  /** When it isn't in the sheet and that's fine ("You can mark preferred contractors after importing."). */
  note?: string
  /** Settled without a column (every row at one restaurant), so not marked. */
  satisfied?: boolean
  onPick: (column: number | null) => void
  /** Under the column choice: another way to settle it ("Every row is at"). */
  children?: ReactNode
}) {
  const matched = column !== null
  const warn = !matched && !note && !satisfied
  return (
    <div
      className={`flex flex-none flex-col gap-2 rounded-card border px-3.5 py-3 ${
        warn ? 'border-reopened-banner-border bg-reopened-banner-bg' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-15 font-bold">
          {title} {required && <span className="text-11 font-bold text-urgent">Required</span>}
        </span>
        {matched || satisfied ? (
          <span className="inline-flex items-center gap-1 text-12 font-bold text-brand-strong">
            <IconCheck size={14} strokeWidth={2.6} />
            Matched
          </span>
        ) : (
          warn && <span className="text-12 font-bold text-status-waiting-text">Not matched</span>
        )}
      </div>
      <Select
        label={`${title}: which column?`}
        labelClassName="sr-only"
        value={column === null ? '' : String(column)}
        onChange={(e) => onPick(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{matched ? 'Don’t import' : required ? 'Choose a column' : 'Not in this sheet'}</option>
        {columns.map((c) => (
          <option key={c.i} value={c.i}>
            Column: {c.title}
          </option>
        ))}
      </Select>
      {matched && sample && <span className="text-12 leading-[1.4] text-text-secondary">e.g. {sample}</span>}
      {!matched && suggestion && (
        <button
          type="button"
          onClick={() => onPick(suggestion.i)}
          className="inline-flex min-h-9 self-start rounded-pill border border-reopened-banner-border bg-status-waiting-bg px-3 text-13 font-semibold text-reopened-banner-text"
        >
          <span className="self-center">Use “{suggestion.title}”?</span>
        </button>
      )}
      {!matched && note && <span className="text-12 leading-[1.4] text-text-secondary">{note}</span>}
      {children}
    </div>
  )
}

/** "Not imported": the sheet's columns no field uses. */
export function NotImported({ titles }: { titles: string[] }) {
  if (titles.length === 0) return null
  return (
    <div className="flex flex-none flex-col gap-2 pt-1">
      <span className="eyebrow">Not imported</span>
      <div className="flex flex-wrap gap-1.5">
        {titles.map((t, i) => (
          <span
            key={i}
            className="inline-flex min-h-7 items-center rounded-pill bg-surface-sunken px-2.5 text-12 font-semibold text-text-body"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Ready, Need a fix, Already exist. */
export function ReviewCounts({ ready, fix, duplicate }: { ready: number; fix: number; duplicate: number }) {
  const tile = (n: number, label: string, tone: string) => (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-input border border-border bg-surface px-3 py-2.5">
      <b className={`font-display text-24 font-bold leading-[1.1] ${tone}`}>{n}</b>
      <span className="text-12 leading-[1.3] text-text-secondary">{label}</span>
    </div>
  )
  return (
    <div className="grid flex-none grid-cols-3 gap-2">
      {tile(ready, 'Ready', 'text-brand-strong')}
      {tile(fix, 'Need a fix', 'text-status-waiting-text')}
      {tile(duplicate, 'Already exist', 'text-info')}
    </div>
  )
}

/**
 * A problem on one or more rows: pick a value from a list or type one, then Apply (or Save
 * for one row), or Skip; once done, a line saying what happened, with Undo.
 */
export function IssueCard({
  title,
  who,
  rows,
  kind,
  options,
  pickLabel = 'Choose…',
  initial = '',
  inputType = 'text',
  placeholder,
  done,
  onApply,
  onSkip,
  onUndo,
}: {
  title: string
  who: string
  rows: number
  kind: 'pick' | 'input' | 'skip'
  options?: { value: string; label: string }[]
  pickLabel?: string
  initial?: string
  inputType?: 'text' | 'tel' | 'email' | 'date'
  placeholder?: string
  /** Once fixed or skipped: what it says. */
  done?: { fixed: boolean; text: string } | null
  onApply: (value: string) => void
  onSkip: () => void
  onUndo: () => void
}) {
  const [value, setValue] = useState(initial)
  if (done) {
    return (
      <div className="flex flex-none items-center gap-2.5 rounded-input border border-border bg-surface px-3.5 py-2.5 text-14">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full font-bold ${
            done.fixed ? 'bg-brand-tint text-brand-strong' : 'bg-surface-muted text-text-secondary'
          }`}
        >
          {done.fixed ? <IconCheck size={14} strokeWidth={2.8} /> : '–'}
        </span>
        <span className="min-w-0 flex-1">{done.text}</span>
        <button type="button" onClick={onUndo} className="min-h-10 flex-none px-1 text-14 font-semibold text-brand">
          Undo
        </button>
      </div>
    )
  }
  const many = rows > 1
  return (
    <section
      aria-label={title}
      className="flex flex-none flex-col gap-2.5 rounded-input border border-l-4 border-reopened-banner-border border-l-choice-inhouse-border bg-surface px-3.5 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-15 font-bold [overflow-wrap:anywhere]">{title}</span>
        <span className="text-12 leading-[1.4] text-text-secondary">{who}</span>
      </div>
      {kind === 'pick' && (
        <Select label={title} labelClassName="sr-only" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{pickLabel}</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
      {kind === 'input' && (
        <Input
          label={title}
          labelClassName="sr-only"
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="min-h-10 flex-none px-0 text-14 font-semibold text-text-secondary hover:text-text"
        >
          {many ? `Skip ${rows} rows` : 'Skip this row'}
        </button>
        {kind !== 'skip' && (
          <Button variant="compact" disabled={!value.trim()} onClick={() => onApply(value.trim())}>
            {many ? `Apply to ${rows} rows` : 'Save'}
          </Button>
        )}
      </div>
    </section>
  )
}

/** A row already in OnTrack: Skip this row or Update existing. */
export function DuplicateCard({
  title,
  sub,
  update,
  onChange,
}: {
  title: string
  sub: string
  update: boolean
  onChange: (update: boolean) => void
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-none flex-col gap-2.5 rounded-input border border-l-4 border-border border-l-info bg-surface px-3.5 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-15 font-bold [overflow-wrap:anywhere]">{title}</span>
        <span className="text-12 leading-[1.4] text-text-secondary">{sub}</span>
      </div>
      <Segmented
        size="sm"
        label={`${title}: skip or update`}
        value={update ? 'update' : 'skip'}
        onChange={(v) => onChange(v === 'update')}
        options={[
          { value: 'skip', label: 'Skip this row' },
          { value: 'update', label: 'Update existing' },
        ]}
      />
    </section>
  )
}

/** The rows ready to import, a few of them and how many more. */
export function ReadyList({ rows, total }: { rows: { title: string; sub: string }[]; total: number }) {
  if (total === 0) return null
  const more = total - rows.length
  return (
    <div className="flex-none overflow-hidden rounded-input border border-border bg-surface">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 border-t border-surface-muted px-3.5 py-2.5 text-14 first:border-t-0"
        >
          <span className="font-semibold [overflow-wrap:anywhere]">{r.title}</span>
          <span className="text-12 leading-[1.4] text-text-secondary [overflow-wrap:anywhere]">{r.sub}</span>
        </div>
      ))}
      {more > 0 && (
        <div className="border-t border-surface-muted px-3.5 py-2.5 text-13 text-text-secondary">and {more} more</div>
      )}
    </div>
  )
}

/** Import complete: the check, "40 contractors imported", from which file, the counts, and the undo note. */
export function ImportDone({
  title,
  file,
  added,
  updated,
  skipped,
  note,
}: {
  title: string
  file: string
  added: number
  updated: number
  skipped: number
  note: string
}) {
  const row = (label: string, n: number) => (
    <div className="flex items-center justify-between border-t border-surface-muted px-3.5 py-2.5 text-14 first:border-t-0">
      <span>{label}</span>
      <b>{n}</b>
    </div>
  )
  return (
    <>
      <div className="flex flex-none flex-col items-center gap-3 pb-2 pt-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand-strong">
          <IconCheck size={30} strokeWidth={2.4} />
        </span>
        <h2 className="font-display text-26 font-bold tracking-[-0.01em]">{title}</h2>
        <span className="text-14 text-text-secondary [overflow-wrap:anywhere]">From {file}</span>
      </div>
      <div className="flex-none overflow-hidden rounded-input border border-border bg-surface">
        {row('Added', added)}
        {row('Updated', updated)}
        {row('Skipped', skipped)}
      </div>
      <span className="flex-none text-center text-12 leading-[1.4] text-text-secondary">{note}</span>
    </>
  )
}

/** On Add contractor and Add equipment: "Adding a lot of contractors? Import them from a spreadsheet". */
export function ImportBanner({ to, noun }: { to: string; noun: string }) {
  return (
    <Link
      to={to}
      className="flex flex-none items-center gap-3 rounded-card bg-brand-tint-soft px-3.5 py-3.5 text-brand-strong no-underline hover:bg-brand-tint hover:text-brand-strong"
    >
      <IconFileUpload size={24} className="flex-none" />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-15 font-bold">Adding a lot of {noun}?</span>
        <span className="text-13">Import them from a spreadsheet</span>
      </span>
      <IconChevronRight size={18} className="flex-none" />
    </Link>
  )
}

/** A row's place in the review table (OT-161): its state, and for one already in OnTrack, whether it updates. */
export type TableRow = { row: number; values: Record<string, string>; state: RowState; update?: boolean }

/** Cells that read wrong broken across lines: a phone number, a model or serial, a date. */
const NO_WRAP = new Set(['phone', 'model', 'serial', 'installed', 'warranty'])

const ROW_TAG: Record<RowState | 'update', { text: string; cls: string }> = {
  ready: { text: 'Ready', cls: 'bg-status-fixed-bg text-status-fixed-text' },
  fix: { text: 'Needs a fix', cls: 'bg-status-open-bg text-status-open-text' },
  skipped: { text: 'Skipped', cls: 'bg-status-closed-bg text-status-closed-text' },
  duplicate: { text: 'In OnTrack · skipped', cls: 'bg-status-closed-bg text-status-closed-text' },
  update: { text: 'Updates existing', cls: 'bg-status-progress-bg text-status-progress-text' },
}

/**
 * The review on a laptop (OT-161; no board draws it): every row of the file in a table, as
 * it will be imported, beside the same fix cards. Fixes show in the cells as they are
 * made; a cell an open problem points at is marked, and an empty one says Missing. Wider
 * than its column, it scrolls sideways inside its card.
 */
export function ReviewTable({
  columns,
  rows,
  problems,
}: {
  columns: { key: string; title: string }[]
  rows: TableRow[]
  /** "row:field" for each cell an unresolved problem points at. */
  problems: Set<string>
}) {
  return (
    <section aria-label="Every row" className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-2">
      <span className="eyebrow">Every row · {rows.length}</span>
      <div className="min-h-0 w-full max-w-full overflow-auto rounded-card border border-border bg-surface">
        <table className="w-full border-collapse text-left text-13">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-12 font-semibold text-text-secondary">
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Row
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  {c.title}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tag = ROW_TAG[r.state === 'duplicate' && r.update ? 'update' : r.state]
              const out = r.state === 'skipped' || (r.state === 'duplicate' && !r.update)
              return (
                <tr key={r.row} className="border-t border-surface-muted first:border-t-0">
                  <td className="px-3 py-2 font-mono text-12 text-text-muted">{r.row}</td>
                  {columns.map((c) => {
                    const value = r.values[c.key] ?? ''
                    const problem = problems.has(`${r.row}:${c.key}`)
                    return (
                      <td
                        key={c.key}
                        className={`max-w-[260px] px-3 py-2 align-top [overflow-wrap:break-word] ${NO_WRAP.has(c.key) ? 'whitespace-nowrap' : ''} ${
                          problem ? 'font-semibold text-status-open-text' : out ? 'text-text-muted' : 'text-text-body'
                        }`}
                      >
                        {value || (problem ? 'Missing' : '')}
                        {/* The mark is a color, so say it in words too (OT-162). */}
                        {problem && value && <span className="sr-only"> (needs a fix)</span>}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-chip px-2 py-0.5 text-12 font-semibold ${tag.cls}`}
                    >
                      {tag.text}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
