// Writes the two workbooks checklist-import-workbook.spec.ts uploads. Run it from app/ only
// to change them: node e2e/stack/fixtures/make-workbooks.mjs
//
// checklist.xlsx is a header and two rows. checklist-large.xlsx adds 900 rows with long
// directions, so its sheet is over 512 KB unzipped, the size from which read-excel-file's
// unzipper (fflate) hands the work to a web worker.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'

const HEADER = ['Section', 'Section short name', 'Area', 'Group', 'Item', 'Directions', 'How-to video link', 'Category']
const SMALL = [
  HEADER,
  ['Workbook section', 'WB', 'Back of House', 'Workbook group', 'Read from a workbook', 'Typed in Excel', '', ''],
  [
    'Workbook section',
    'WB',
    'Back of House',
    'Workbook group',
    'And a second row',
    '',
    'https://example.com/how-to',
    '',
  ],
]
const LARGE = [
  ...SMALL,
  ...Array.from({ length: 900 }, (_, i) => [
    'Large section',
    'Large',
    'Back of House',
    `Group ${i % 20}`,
    `Item number ${i}`,
    `Directions ${i} `.repeat(110).trim(),
    '',
    '',
  ]),
]

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cell = (text, x, y) =>
  text ? `<c r="${String.fromCharCode(65 + x)}${y + 1}" t="inlineStr"><is><t>${escape(text)}</t></is></c>` : ''

function workbook(rows) {
  const sheet = rows.map((r, y) => `<row r="${y + 1}">${r.map((c, x) => cell(c, x, y)).join('')}</row>`).join('')
  const files = {
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `${XML}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${XML}<workbook xmlns="${MAIN}" xmlns:r="${DOC}"><sheets><sheet name="Checklist" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${XML}<worksheet xmlns="${MAIN}"><sheetData>${sheet}</sheetData></worksheet>`,
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, strToU8(body)])))
}

const here = (name) => fileURLToPath(new URL(name, import.meta.url))
writeFileSync(here('./checklist.xlsx'), workbook(SMALL))
writeFileSync(here('./checklist-large.xlsx'), workbook(LARGE))
