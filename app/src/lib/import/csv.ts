/**
 * CSV in and out for imports (OT-137; Phase 7's contractor and equipment imports reuse it).
 * Reading follows RFC 4180: quoted fields with commas, quotes and line breaks, CRLF or LF,
 * and a byte order mark from Excel. Writing quotes what needs it and guards against formula
 * injection: a cell that starts with = + - @ (or a tab or carriage return) gets a leading
 * apostrophe, which a spreadsheet shows as text, and reading takes it off again.
 */

const FORMULA = /^[=+\-@\t\r]/

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map(unguard))
}

/** A cell as a spreadsheet should read it: quoted when needed, never run as a formula. */
function cell(value: string) {
  const v = FORMULA.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: string[][]) {
  // CRLF and a byte order mark, so Excel opens it as UTF-8 with the rows where they belong.
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Takes off the apostrophe toCsv puts before a cell that would read as a formula. */
export function unguard(value: string) {
  return value.length > 1 && value[0] === "'" && FORMULA.test(value.slice(1)) ? value.slice(1) : value
}
