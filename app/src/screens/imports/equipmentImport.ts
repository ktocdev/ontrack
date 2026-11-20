/**
 * Import equipment's rules (OT-152; Import-Equipment-*), on the same pieces as Import
 * contractors: the fields and the names a sheet uses for them, the template, the problems
 * the review asks about, and the rows import_equipment takes (OT-149). It follows Add
 * equipment: a unit needs a name, a restaurant (from its column, or one chosen for every
 * row), an area and a category from that area. A restaurant or category the lists don't
 * have is matched to one that exists with a suggestion, or the row skipped: categories are
 * added on Categories, never here. A unit already in OnTrack has the same name, or the same
 * serial number when both have one, at the same restaurant.
 *
 * The review goes in two passes: the restaurant and area first, then, on the rows with
 * those settled, the category (which depends on the area) and the units already there
 * (which depend on the restaurant). A warranty that reads as a date is the warranty date;
 * anything else ("Parts through 2027") is kept as the warranty note.
 */
import { AREA_LABEL, AREA_SHORT, AREAS, type Area } from '../../app/areas'
import type { FieldSpec } from '../../lib/import/columns'
import { equipmentDuplicates } from '../../lib/import/duplicates'
import { exactOption, unmatchedValues, type Option } from '../../lib/import/match'
import { parseDay } from '../../lib/import/values'
import { whoLine, type Issue, type RowState } from './review'

export type EquipmentField =
  'name' | 'restaurant' | 'area' | 'category' | 'brand' | 'model' | 'serial' | 'installed' | 'warranty'

export const EQUIPMENT_FIELDS: FieldSpec<EquipmentField>[] = [
  {
    key: 'name',
    title: 'Name',
    aliases: ['Item', 'Unit', 'Equipment', 'Equipment name', 'Description'],
    required: true,
  },
  { key: 'restaurant', title: 'Restaurant', aliases: ['Location', 'Store', 'Site', 'Restaurant name'], required: true },
  { key: 'area', title: 'Area', aliases: ['FOH/BOH', 'BOH/FOH', 'Front or back', 'Side', 'Section'], required: true },
  { key: 'category', title: 'Category', aliases: ['Type', 'Equipment type', 'Kind'], required: true },
  { key: 'brand', title: 'Brand', aliases: ['Make', 'Manufacturer', 'Mfr'] },
  { key: 'model', title: 'Model', aliases: ['Model #', 'Model number', 'Model no'] },
  { key: 'serial', title: 'Serial number', aliases: ['Serial', 'Serial #', 'Serial no', 'S/N', 'SN'] },
  { key: 'installed', title: 'Installed', aliases: ['Installed on', 'Date installed', 'In service'] },
  { key: 'warranty', title: 'Warranty', aliases: ['Warranty until', 'Warranty expires', 'Warranty through'] },
]

export const EQUIPMENT_TEMPLATE = [EQUIPMENT_FIELDS.map((f) => f.title)]

export const EQUIPMENT_LATER: Partial<Record<EquipmentField, string>> = {
  installed: 'Not in your sheet. You can add install dates per unit later.',
  warranty: 'Not in your sheet. You can add warranties per unit later.',
  brand: 'Not in your sheet. You can add it per unit later.',
  model: 'Not in your sheet. You can add it per unit later.',
  serial: 'Not in your sheet. You can add it per unit later.',
}

export type Category = { id: string; name: string; area: Area; active: boolean }
export type Restaurant = { id: string; name: string }
export type Unit = { id: string; name: string; serial: string | null; restaurant_id: string; retired_at: string | null }
type Rec = { row: number; values: Record<EquipmentField, string> }

/** The areas by the words a sheet uses for them: "BOH", "Back", "Kitchen", "Front of House". */
const AREA_OPTIONS: Option[] = AREAS.map((a) => ({
  id: a,
  name: AREA_LABEL[a],
  aliases: [
    AREA_SHORT[a],
    ...{ foh: ['Front', 'FOH', 'Dining', 'Bar'], boh: ['Back', 'BOH', 'Kitchen'], it: ['Tech', 'Technology'] }[a],
  ],
}))

export const areaOf = (value: string) => exactOption(value, AREA_OPTIONS)?.id as Area | undefined

/** First pass: restaurants and areas the lists don't have, and what a row is missing or can't be read. */
export function equipmentReviewFirst(records: Rec[], restaurants: Restaurant[], oneRestaurant: boolean) {
  const label = (r: Rec) => r.values.name || 'No name'
  const issues: Issue<EquipmentField>[] = []
  const options = restaurants.map((r) => ({ id: r.id, name: r.name }))

  if (!oneRestaurant) {
    for (const g of unmatchedValues(records, (r) => [r.values.restaurant], options)) {
      issues.push({
        id: `restaurant:${g.value.toLowerCase()}`,
        field: 'restaurant',
        kind: 'pick',
        title: `“${g.value}” isn’t a restaurant name`,
        who:
          g.rows.length > 1
            ? `${g.rows.length} rows · pick the restaurant it means`
            : whoLine([{ row: g.rows[0]!.row, label: label(g.rows[0]!) }]),
        rows: g.rows.map((r) => r.row),
        options: restaurants.map((r) => ({ value: r.name, label: r.name })),
        pickLabel: 'Choose a restaurant',
        initial: g.suggestion?.name ?? '',
        fixedText: (v) => `Set to ${v}`,
      })
    }
  }
  for (const g of unmatchedValues(records, (r) => [r.values.area], AREA_OPTIONS)) {
    issues.push({
      id: `area:${g.value.toLowerCase()}`,
      field: 'area',
      kind: 'pick',
      title: `“${g.value}” isn’t an area`,
      who: whoLine(g.rows.map((r) => ({ row: r.row, label: label(r) }))),
      rows: g.rows.map((r) => r.row),
      options: AREAS.map((a) => ({ value: AREA_LABEL[a], label: AREA_LABEL[a] })),
      pickLabel: 'Choose an area',
      initial: g.suggestion?.name ?? '',
      fixedText: (v) => `Set to ${v}`,
    })
  }

  for (const r of records) {
    const add = (issue: Omit<Issue<EquipmentField>, 'rows' | 'who'>) =>
      issues.push({ ...issue, rows: [r.row], who: whoLine([{ row: r.row, label: label(r) }]) })
    if (!r.values.name) {
      add({
        id: `name:${r.row}`,
        field: 'name',
        kind: 'input',
        title: 'Name is missing',
        placeholder: 'Walk-in Cooler 1',
        fixedText: (v) => `Named ${v}`,
      })
    }
    if (!oneRestaurant && !r.values.restaurant) {
      add({
        id: `restaurant:${r.row}`,
        field: 'restaurant',
        kind: 'pick',
        title: 'Restaurant is missing',
        options: restaurants.map((x) => ({ value: x.name, label: x.name })),
        pickLabel: 'Choose a restaurant',
        fixedText: (v) => `Set to ${v}`,
      })
    }
    if (!r.values.area) {
      add({
        id: `area:${r.row}`,
        field: 'area',
        kind: 'pick',
        title: 'Area is missing',
        options: AREAS.map((a) => ({ value: AREA_LABEL[a], label: AREA_LABEL[a] })),
        pickLabel: 'Choose an area',
        fixedText: () => 'Area set',
      })
    }
    if (r.values.installed && parseDay(r.values.installed) === null) {
      add({
        id: `installed:${r.row}`,
        field: 'installed',
        kind: 'input',
        inputType: 'date',
        title: `“${r.values.installed}” isn’t a date`,
        fixedText: (v) => `Installed ${v}`,
      })
    }
  }
  return issues
}

/** A row's restaurant: the one chosen for every row, else its column's, by name. */
export function restaurantOf(value: string, restaurants: Restaurant[], chosen: string | null) {
  if (chosen) return chosen
  return exactOption(value, restaurants)?.id
}

/**
 * Second pass, on the rows the first leaves settled: categories the area doesn't have (or
 * has turned off), units already in OnTrack, and units the file has twice.
 */
export function equipmentReviewSecond(
  records: Rec[],
  settled: Set<number>,
  restaurants: Restaurant[],
  chosen: string | null,
  categories: Category[],
  units: Unit[],
) {
  const label = (r: Rec) => r.values.name || 'No name'
  const issues: Issue<EquipmentField>[] = []
  const ready = records.filter((r) => settled.has(r.row))

  for (const area of AREAS) {
    const here = ready.filter((r) => areaOf(r.values.area) === area)
    const active = categories.filter((c) => c.area === area && c.active)
    for (const g of unmatchedValues(here, (r) => [r.values.category], active)) {
      const off = categories.find((c) => c.area === area && !c.active && exactOption(g.value, [c]))
      issues.push({
        id: `category:${area}:${g.value.toLowerCase()}`,
        field: 'category',
        kind: 'pick',
        title: off ? `“${g.value}” is turned off` : `“${g.value}” isn’t a ${AREA_LABEL[area]} category`,
        who: whoLine(g.rows.map((r) => ({ row: r.row, label: label(r) }))),
        rows: g.rows.map((r) => r.row),
        options: active.map((c) => ({ value: c.name, label: c.name })),
        pickLabel: 'Choose a category',
        initial: g.suggestion?.name ?? '',
        fixedText: (v) => `Set to ${v}`,
      })
    }
    for (const r of here.filter((x) => !x.values.category)) {
      issues.push({
        id: `category:${r.row}`,
        field: 'category',
        kind: 'pick',
        title: 'Category is missing',
        who: whoLine([{ row: r.row, label: label(r) }]),
        rows: [r.row],
        options: active.map((c) => ({ value: c.name, label: c.name })),
        pickLabel: 'Choose a category',
        fixedText: (v) => `Set to ${v}`,
      })
    }
  }

  const byId = new Map(restaurants.map((r) => [r.id, r]))
  const { matches, twice } = equipmentDuplicates(
    ready.map((r) => ({
      row: r.row,
      name: r.values.name,
      serial: r.values.serial,
      restaurantId: restaurantOf(r.values.restaurant, restaurants, chosen) ?? null,
    })),
    units,
  )
  for (const t of twice) {
    issues.push({
      id: `twice:${t.row.row}`,
      field: 'name',
      kind: 'skip',
      title: `${t.row.name} is in the file twice`,
      who: `Row ${t.row.row} · also on row ${t.first.row}`,
      rows: [t.row.row],
      fixedText: () => '',
    })
  }
  const duplicates = new Map(
    matches.map((m) => [
      m.row.row,
      {
        title: m.existing.name,
        sub:
          m.by === 'serial'
            ? `Row ${m.row.row} · serial ${m.existing.serial} is already in OnTrack`
            : `Row ${m.row.row} · same name as a unit at ${byId.get(m.existing.restaurant_id)?.name ?? 'this restaurant'}`,
      },
    ]),
  )
  return { issues, duplicates }
}

/** What import_equipment takes: the one restaurant or none, the file's columns, the rows. */
export function equipmentPayload(
  records: Rec[],
  states: Map<number, RowState>,
  updates: Set<number>,
  mapped: Set<EquipmentField>,
  restaurants: Restaurant[],
  chosen: string | null,
  categories: Category[],
) {
  const columns = ['name']
  if (mapped.has('category')) columns.push('category_id')
  if (mapped.has('brand')) columns.push('brand')
  if (mapped.has('model')) columns.push('model')
  if (mapped.has('serial')) columns.push('serial')
  if (mapped.has('installed')) columns.push('installed_on')
  if (mapped.has('warranty')) columns.push('warranty_until', 'warranty_note')
  const rows = records
    .filter((r) => states.get(r.row) === 'ready' || (states.get(r.row) === 'duplicate' && updates.has(r.row)))
    .map((r) => {
      const v = r.values
      const area = areaOf(v.area)
      const category = categories.find((c) => c.area === area && exactOption(v.category, [c]))
      const warranty = parseDay(v.warranty, { endOfMonth: true })
      return {
        row: r.row,
        restaurant_id: chosen ? null : (restaurantOf(v.restaurant, restaurants, null) ?? null),
        category_id: category?.id ?? null,
        name: v.name,
        brand: v.brand,
        model: v.model,
        serial: v.serial,
        installed_on: parseDay(v.installed) || null,
        warranty_until: warranty || null,
        warranty_note: warranty === null ? v.warranty : null,
        on_duplicate: updates.has(r.row) ? 'update' : 'skip',
      }
    })
  return { columns, rows }
}
