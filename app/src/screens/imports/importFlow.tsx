import { useRef, useState } from 'react'
import { splitSheet, type Sheet } from '../../lib/import/columns'
import { readSheetFile, SheetError } from '../../lib/import/sheet'
import { IssueCard } from './ImportParts'
import type { Issue, Resolutions } from './review'

/**
 * What every import screen does the same way (OT-151, OT-152): read the file picked into a
 * sheet, show each problem as a card with its fix or skip, and word the database's refusal.
 */

/** The hidden file input, the sheet read from it, and why one couldn't be read. */
export function useSheetPick(onRead: (sheet: Sheet) => void) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; sheet: Sheet } | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setReading(true)
    try {
      const sheet = splitSheet(await readSheetFile(f))
      if (sheet.body.length === 0) throw new SheetError('That sheet has no rows under its first row of titles.')
      setFile({ name: f.name, sheet })
      onRead(sheet)
    } catch (e) {
      setError(e instanceof SheetError ? e.message : 'That file couldn’t be read. Try it as .xlsx or .csv.')
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }
  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      className="sr-only"
      aria-label="Spreadsheet to import"
      onChange={(e) => void pick(e.target.files?.[0])}
    />
  )
  const columns = file ? file.sheet.header.map((title, i) => ({ title, i })).filter((c) => c.title !== '') : []
  const summary = file && {
    name: file.name,
    rows: file.sheet.body.length,
    columns: columns.length,
    firstRows: file.sheet.body.slice(0, 3).map((r) => r.cells.filter(Boolean).slice(0, 3).join(' · ')),
  }
  return { file, columns, summary, reading, error, fileInput, choose: () => input.current?.click() }
}

/** Each problem as a card: fix it for every row it covers, skip them, or undo either. */
export function IssueList<F extends string>({
  issues,
  resolutions,
  onChange,
}: {
  issues: Issue<F>[]
  resolutions: Resolutions
  onChange: (next: Resolutions) => void
}) {
  return (
    <>
      {issues.length > 0 && <span className="eyebrow pt-1.5">Needs a fix</span>}
      {issues.map((x) => {
        const res = resolutions[x.id]
        const rows = `${x.rows.length} ${x.rows.length > 1 ? 'rows' : 'row'}`
        return (
          <IssueCard
            key={x.id}
            title={x.title}
            who={x.who}
            rows={x.rows.length}
            kind={x.kind}
            options={x.options}
            pickLabel={x.pickLabel}
            initial={x.initial}
            inputType={x.inputType}
            placeholder={x.placeholder}
            done={
              res &&
              (res.status === 'fixed'
                ? { fixed: true, text: `${x.fixedText(res.value)} · ${rows} ready` }
                : { fixed: false, text: `Skipped ${rows}` })
            }
            onApply={(value) => onChange({ ...resolutions, [x.id]: { status: 'fixed', value } })}
            onSkip={() => onChange({ ...resolutions, [x.id]: { status: 'skipped' } })}
            onUndo={() => onChange({ ...resolutions, [x.id]: undefined })}
          />
        )
      })}
    </>
  )
}

/** The database's "row 14: …" with a capital, or a plain line when the connection failed. */
export function importMessage(error: unknown) {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/^row \d+:/.test(message)) return `Row ${message.slice(4)}.`
  return 'Check your connection and try again.'
}
