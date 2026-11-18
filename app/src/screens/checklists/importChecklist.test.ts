import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../../lib/import/csv'
import { previewImport, readChecklist, templateRows } from './importChecklist'
import type { EditorItem, EditorSection } from './useChecklistEditor'

const categories = [
  { id: 'elec', name: 'Electrical', area: 'boh' as const, active: true },
  { id: 'felec', name: 'Electrical', area: 'foh' as const, active: true },
  { id: 'hvac', name: 'HVAC', area: 'boh' as const, active: true },
  { id: 'old', name: 'Old', area: 'boh' as const, active: false },
]
const section = (s: Partial<EditorSection> & { id: string; name: string }): EditorSection => ({
  short_name: null,
  area: null,
  sort_order: 0,
  active: true,
  copied_from: null,
  ...s,
})
const item = (i: Partial<EditorItem> & { id: string; section_id: string; title: string }): EditorItem => ({
  group_name: 'Electrical',
  directions: null,
  video_url: null,
  category_id: null,
  sort_order: 0,
  active: true,
  copied_from: null,
  ...i,
})
const sections = [section({ id: 'k', name: 'Kitchen', short_name: 'Kitchen', area: 'boh' })]
const items = [
  item({ id: 'a', section_id: 'k', title: 'Outlets', category_id: 'elec', copied_from: 'x' }),
  item({ id: 'b', section_id: 'k', title: 'Light bulbs' }),
  item({ id: 'c', section_id: 'k', title: 'Old fan', active: false }),
]

describe('the template', () => {
  it('is the checklist as it goes on a walkthrough, and reads back the same', () => {
    const rows = templateRows(sections, items, categories)
    expect(rows[0]).toEqual([
      'Section',
      'Section short name',
      'Area',
      'Group',
      'Item',
      'Directions',
      'How-to video link',
      'Category',
    ])
    expect(rows.slice(1).map((r) => r[4])).toEqual(['Outlets', 'Light bulbs'])
    const back = readChecklist(parseCsv(toCsv(rows)), categories)
    expect(back.problems).toEqual([])
    expect(previewImport(sections, items, back.rows, false)).toMatchObject({ added: [], changed: [], unchanged: 2 })
  })
})

describe('reading a sheet', () => {
  it('names each problem by its row', () => {
    const r = readChecklist(
      [
        ['Section', 'Area', 'Group', 'Item', 'How-to video link', 'Category'],
        ['Kitchen', 'Back of House', 'Electrical', 'Outlets', 'javascript:x', 'Plumbing'],
        ['Kitchen', 'Front', 'Electrical', '', '', 'Old'],
        ['Kitchen', '', 'electrical', 'OUTLETS', '', ''],
        ['Bar', 'Patio', 'Taps', 'Beer taps', '', ''],
      ],
      categories,
    )
    expect(r.problems).toEqual([
      'Row 2: The video link isn’t a web address (https://…).',
      'Row 2: No category is called “Plumbing”.',
      'Row 3: Item is empty.',
      'Row 3: No category is called “Old”.',
      'Row 3: Kitchen has a different area on row 2.',
      'Row 4: OUTLETS is in Kitchen › electrical twice.',
      'Row 5: Area “Patio” isn’t Front of House, Back of House or IT.',
    ])
  })
  it('says a column is missing', () => {
    expect(readChecklist([['Section', 'Item']], categories).problems).toEqual([
      'The sheet has no Group column. Start from the template.',
    ])
  })
  it('gives a section’s area to its rows that leave it blank, and matches categories loosely', () => {
    const r = readChecklist(
      [
        ['Section', 'Area', 'Group', 'Item', 'Category'],
        ['Kitchen', 'BOH', 'Electrical', 'Outlets', 'electrical'],
        ['Kitchen', '', 'Electrical', 'Panel', ''],
      ],
      categories,
    )
    expect(r.problems).toEqual([])
    expect(r.rows.map((x) => [x.area, x.category_id])).toEqual([
      ['boh', 'elec'],
      ['boh', null],
    ])
  })
})

describe('a category two areas share', () => {
  it('is written with its area, and read by it, or by the row’s area', () => {
    const rows = templateRows(sections, items, categories)
    expect(rows[1]![7]).toBe('Electrical (Back of House)')
    const r = readChecklist(
      [
        ['Section', 'Area', 'Group', 'Item', 'Category'],
        ['Bar', 'Front of House', 'Electrical', 'Taps', 'Electrical'],
        ['Kitchen', 'Back of House', 'Electrical', 'Outlets', 'electrical (front of house)'],
        ['Exterior', '', 'Electrical', 'Lamps', 'Electrical'],
        ['Exterior', '', 'Air', 'Units', 'hvac'],
      ],
      categories,
    )
    expect(r.rows.map((x) => x.category_id)).toEqual(['felec', 'felec', null, 'hvac'])
    expect(r.problems).toEqual([
      'Row 4: “Electrical” is in more than one area; write it as “Electrical (Back of House)” or the like.',
    ])
  })
})

describe('the preview', () => {
  it('sorts the items into added, changed, unchanged and removed, and says what is kept', () => {
    const { rows } = readChecklist(
      [
        ['Section', 'Group', 'Item', 'Directions', 'Category'],
        ['Kitchen', 'Electrical', 'Outlets', 'Behind the line too', 'Electrical'],
        ['Patio', 'Furniture', 'Umbrellas', '', ''],
      ],
      categories,
    )
    const p = previewImport(sections, items, rows, false)
    expect(p.added.map((r) => r.title)).toEqual(['Umbrellas'])
    expect(p.changed.map((c) => c.to.title)).toEqual(['Outlets'])
    expect(p.removed.map((i) => [i.title, i.kept])).toEqual([['Light bulbs', false]])
    expect(p.newSections).toEqual(['Patio'])
    expect(p.goneSections).toEqual([])
    expect(previewImport(sections, items, rows, true).removed[0]!.kept).toBe(true)
  })
})
