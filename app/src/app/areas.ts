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
