/**
 * A spreadsheet file's first sheet as rows of text (OT-137; for Phase 7's imports too): CSV
 * read here, .xlsx through read-excel-file, loaded only when a workbook is picked. Numbers
 * and dates come out as text, a date as its day (2026-11-18).
 */
import { parseCsv } from './csv'

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_ROWS = 2000

/** Why a file couldn't be read, in words for the person who picked it. */
export class SheetError extends Error {}

function text(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export async function readSheetFile(file: File): Promise<string[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new SheetError('That file is over 2 MB. Check it is the right one.')
  }
  const name = file.name.toLowerCase()
  let rows: string[][]
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    rows = parseCsv(await file.text())
  } else if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    try {
      rows = (await readSheet(file)).map((r) => r.map(text))
    } catch {
      throw new SheetError('That workbook couldn’t be read. Save it again as .xlsx or .csv and try once more.')
    }
  } else {
    throw new SheetError('Pick a spreadsheet saved as .xlsx or .csv.')
  }
  if (rows.length > MAX_ROWS) throw new SheetError(`That sheet has over ${MAX_ROWS} rows.`)
  return rows
}

/** Hands the person a file to save. */
export function downloadText(name: string, body: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
