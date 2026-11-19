import type { Database } from '../lib/database.types'

/**
 * The areas a category, and so a unit or a ticket, belongs to: Front of House, Back of
 * House, and IT (OT-115), which is the group's IT department's. The one place their names
 * and order live; screens that pick an area offer all three, in this order.
 */
export type Area = Database['public']['Enums']['area']

export const AREAS: Area[] = ['foh', 'boh', 'it']

export const AREA_LABEL: Record<Area, string> = { foh: 'Front of House', boh: 'Back of House', it: 'IT' }

/** The short form on cards and breadcrumbs: "FOH · Plumbing". */
export const AREA_SHORT: Record<Area, string> = { foh: 'FOH', boh: 'BOH', it: 'IT' }

/** The options for a `Segmented` that picks an area. */
export const AREA_SEGMENTS = AREAS.map((value) => ({ value, label: AREA_LABEL[value] }))

/** An area from a URL or anywhere untyped, or the fallback. */
export function areaOr(value: string | null | undefined, fallback: Area): Area {
  return (AREAS as string[]).includes(value ?? '') ? (value as Area) : fallback
}

/** The same in short words, where four segments share the width (the filter sheet's All). */
export const AREA_SEGMENTS_SHORT = AREAS.map((value) => ({
  value,
  label: { foh: 'Front', boh: 'Back', it: 'IT' }[value],
}))

/** Back of House first, as the equipment board lists it, then Front, then IT. */
export const AREA_RANK: Record<Area, number> = { boh: 0, foh: 1, it: 2 }

/** What the screens read from a ticket to say where it belongs. */
export type Placed = {
  category?: { name: string; area: Area } | null
  area?: Area | null
  checklist_place?: string | null
}

/**
 * A ticket's area: its category's, or, for a walkthrough ticket with no category (OT-141),
 * the one it carries from its checklist section.
 */
export function ticketArea(t: Placed): Area | null {
  return t.category?.area ?? t.area ?? null
}

/**
 * Where a ticket belongs, as parts for a card (joined with " · ") or a header (" › "): its
 * area and category, or, with no category, its place on the walkthrough's checklist
 * ("FOH › Health and Safety › Caulk"), which names its section in its own words.
 */
export function ticketPlace(t: Placed, form: 'short' | 'long' = 'short'): string[] {
  const names = form === 'short' ? AREA_SHORT : AREA_LABEL
  if (t.category) return [names[t.category.area], t.category.name]
  if (t.checklist_place) return [t.checklist_place]
  return t.area ? [names[t.area]] : []
}
