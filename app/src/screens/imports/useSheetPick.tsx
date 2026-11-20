import { useRef, useState } from 'react'
import { splitSheet, type Sheet } from '../../lib/import/columns'
import { readSheetFile, SheetError } from '../../lib/import/sheet'

/**
 * The file step every import shares (OT-151, OT-152): the hidden file input, the sheet read
 * from the file picked (on the phone; never uploaded), and why one couldn't be read.
 */
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

export type SheetPick = ReturnType<typeof useSheetPick>
