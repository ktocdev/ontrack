import { AREA_LABEL, type Area } from '../../app/areas'
import { diffByKey, readTable, type Column } from '../../lib/import/table'
import { isVideoUrl } from '../quarterly/quarterly'
import type { EditorItem, EditorSection } from './useChecklistEditor'

/**
 * Import a checklist from a spreadsheet (OT-137): the columns, the template (the checklist
 * as it is, so a person edits what is there), reading and checking the rows, and what the
 * import will change. import_checklist() does the same matching: a section by name, an item
 * by its section, group and item, ignoring case.
 */

export const CHECKLIST_COLUMNS: Column<
  'section' | 'sectionShort' | 'area' | 'group' | 'item' | 'directions' | 'video' | 'category'
>[] = [
  { key: 'section', title: 'Section', required: true },
  { key: 'sectionShort', title: 'Section short name', aliases: ['Short name'] },
  { key: 'area', title: 'Area' },
  { key: 'group', title: 'Group', required: true },
  { key: 'item', title: 'Item', aliases: ['Title', 'Check'], required: true },
  { key: 'directions', title: 'Directions' },
  { key: 'video', title: 'How-to video link', aliases: ['Video link', 'Video'] },
  { key: 'category', title: 'Category' },
]

export type ImportRow = {
  row: number
  section: string
  section_short: string | null
  area: Area | null
  group: string
  title: string
  directions: string | null
  video_url: string | null
  category_id: string | null
}

type Category = { id: string; name: string; area: Area; active: boolean }

const AREA_NAMES: Record<string, Area> = {
  frontofhouse: 'foh',
  front: 'foh',
  foh: 'foh',
  backofhouse: 'boh',
  back: 'boh',
  boh: 'boh',
  it: 'it',
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
export const itemKey = (section: string, group: string, title: string) =>
  [section, group, title].map((s) => s.trim().toLowerCase()).join('\u0000')

/**
 * A category as the sheet writes it: its name, with its area where another category shares
 * the name (the group has an Electrical in Front and in Back of House).
 */
export function categoryLabel(c: Category, categories: Category[]) {
  const shared = categories.some((o) => o.id !== c.id && norm(o.name) === norm(c.name))
  return shared ? `${c.name} (${AREA_LABEL[c.area]})` : c.name
}

/** The checklist as it goes on a walkthrough, as the spreadsheet's rows, header first. */
export function templateRows(sections: EditorSection[], items: EditorItem[], categories: Category[]) {
  const name = new Map(categories.map((c) => [c.id, categoryLabel(c, categories)]))
  const rows = [CHECKLIST_COLUMNS.map((c) => c.title)]
  for (const s of sections.filter((x) => x.active)) {
    for (const i of items.filter((x) => x.section_id === s.id && x.active)) {
      rows.push([
        s.name,
        s.short_name ?? '',
        s.area ? AREA_LABEL[s.area] : '',
        i.group_name,
        i.title,
        i.directions ?? '',
        i.video_url ?? '',
        i.category_id ? (name.get(i.category_id) ?? '') : '',
      ])
    }
  }
  return rows
}

/** The file's rows as a checklist, and what is wrong with it, row by row. */
export function readChecklist(rows: string[][], categories: Category[]) {
  const table = readTable(rows, CHECKLIST_COLUMNS)
  const problems: string[] = []
  if (table.missing.length) {
    problems.push(`The sheet has no ${table.missing.join(', ')} column. Start from the template.`)
    return { rows: [] as ImportRow[], problems }
  }
  const active = categories.filter((c) => c.active)
  // "Electrical (Back of House)", or "Electrical", taking the row's area where two share the name.
  const findCategory = (label: string, rowArea: Area | null): Category | 'ambiguous' | undefined => {
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(label)
    const area = m ? (AREA_NAMES[norm(m[2]!)] ?? null) : rowArea
    const named = active.filter((c) => norm(c.name) === norm(m ? m[1]! : label))
    if (named.length <= 1) return named[0]
    return named.find((c) => c.area === area) ?? 'ambiguous'
  }
  const sectionFirst = new Map<string, { area: Area | null; row: number }>()
  const seen = new Set<string>()
  const out: ImportRow[] = []
  for (const { row, values: v } of table.records) {
    const say = (m: string) => problems.push(`Row ${row}: ${m}`)
    if (!v.section) say('Section is empty.')
    else if (v.section.length > 60) say('Section is over 60 characters.')
    if (v.sectionShort.length > 12) say('Section short name is over 12 characters.')
    if (!v.group) say('Group is empty.')
    else if (v.group.length > 60) say('Group is over 60 characters.')
    if (!v.item) say('Item is empty.')
    else if (v.item.length > 140) say('Item is over 140 characters.')
    if (v.directions.length > 2000) say('Directions are over 2,000 characters.')
    if (v.video && !isVideoUrl(v.video)) say('The video link isn’t a web address (https://…).')
    const area = v.area ? (AREA_NAMES[norm(v.area)] ?? null) : null
    if (v.area && !area) say(`Area “${v.area}” isn’t Front of House, Back of House or IT.`)
    const sectionArea = area ?? sectionFirst.get(v.section.toLowerCase())?.area ?? null
    const found = v.category ? findCategory(v.category, sectionArea) : undefined
    if (v.category && !found) say(`No category is called “${v.category}”.`)
    if (found === 'ambiguous')
      say(`“${v.category}” is in more than one area; write it as “${v.category} (Back of House)” or the like.`)
    const category = found === 'ambiguous' ? undefined : found
    if (v.section) {
      const first = sectionFirst.get(v.section.toLowerCase())
      if (!first) sectionFirst.set(v.section.toLowerCase(), { area, row })
      else if (v.area && first.area !== area) say(`${v.section} has a different area on row ${first.row}.`)
    }
    const key = itemKey(v.section, v.group, v.item)
    if (v.section && v.group && v.item) {
      if (seen.has(key)) say(`${v.item} is in ${v.section} › ${v.group} twice.`)
      seen.add(key)
    }
    out.push({
      row,
      section: v.section,
      section_short: v.sectionShort || null,
      area: v.area ? area : (sectionFirst.get(v.section.toLowerCase())?.area ?? null),
      group: v.group,
      title: v.item,
      directions: v.directions || null,
      video_url: v.video || null,
      category_id: category?.id ?? null,
    })
  }
  if (!problems.length && out.length === 0) problems.push('The sheet has no items under its header.')
  if (out.length > 1000) problems.push('A checklist has at most 1,000 items.')
  return { rows: out, problems }
}

/** What the import will do to the checklist as it is now. */
export function previewImport(sections: EditorSection[], items: EditorItem[], rows: ImportRow[], used: boolean) {
  const sectionOf = new Map(sections.map((s) => [s.id, s]))
  const existing = items.map((i) => ({ ...i, section: sectionOf.get(i.section_id)!.name }))
  const diff = diffByKey(
    existing,
    rows,
    (i) => itemKey(i.section, i.group_name, i.title),
    (r) => itemKey(r.section, r.group, r.title),
    (i, r) =>
      i.active &&
      (i.directions ?? null) === r.directions &&
      (i.video_url ?? null) === r.video_url &&
      (i.category_id ?? null) === r.category_id,
  )
  const names = new Set(rows.map((r) => r.section.toLowerCase()))
  const removed = diff.removed.filter((i) => i.active)
  return {
    added: diff.added,
    changed: diff.changed,
    unchanged: diff.unchanged.length,
    // What has history is turned off, the rest deleted; on a checklist a walkthrough has had, all of it has.
    removed: removed.map((i) => ({ ...i, kept: used || !!i.copied_from })),
    newSections: [...new Set(rows.map((r) => r.section))].filter(
      (n) => !sections.some((s) => s.name.toLowerCase() === n.toLowerCase()),
    ),
    goneSections: sections.filter((s) => s.active && !names.has(s.name.toLowerCase())).map((s) => s.name),
  }
}

/** The rows as import_checklist() takes them. */
export function toImportJson(rows: ImportRow[]) {
  return rows.map(({ row: _, ...r }) => r)
}
