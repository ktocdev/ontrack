/**
 * Rows already in OnTrack, and rows the file has twice (OT-150), matched the way the
 * database matches them (import_contractors, import_equipment, OT-149), so the review shows
 * what the import will do:
 *   - a contractor: the same name, ignoring case and spaces;
 *   - a unit: the same name, or the same serial number when both have one, at the same
 *     restaurant, not retired.
 */

/** The database's import_key(): lower case with no spaces. */
export const importKey = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, '')

export type Match<R, E> = { row: R; existing: E; by: 'name' | 'serial' }

/** Contractors: each row matched to the one already in OnTrack by name, and rows named twice. */
export function contractorDuplicates<R extends { row: number; name: string }, E extends { name: string }>(
  rows: R[],
  existing: E[],
) {
  const byName = new Map(existing.map((e) => [importKey(e.name), e]))
  const seen = new Map<string, R>()
  const matches: Match<R, E>[] = []
  const twice: { row: R; first: R }[] = []
  for (const r of rows) {
    const key = importKey(r.name)
    if (!key) continue
    const first = seen.get(key)
    if (first) {
      twice.push({ row: r, first })
      continue
    }
    seen.set(key, r)
    const e = byName.get(key)
    if (e) matches.push({ row: r, existing: e, by: 'name' })
  }
  return { matches, twice }
}

/**
 * Units: each row matched to one at the same restaurant by name, else by serial when both
 * have one; and rows that name the same unit twice. Rows with no restaurant yet are left
 * for the review to ask about.
 */
export function equipmentDuplicates<
  R extends { row: number; name: string; serial: string; restaurantId: string | null },
  E extends { name: string; serial: string | null; restaurant_id: string; retired_at?: string | null },
>(rows: R[], existing: E[]) {
  const live = existing.filter((e) => !e.retired_at)
  const seen = new Map<string, R>()
  const matches: Match<R, E>[] = []
  const twice: { row: R; first: R }[] = []
  for (const r of rows) {
    if (!r.restaurantId || !importKey(r.name)) continue
    const nameKey = `${r.restaurantId}/n/${importKey(r.name)}`
    const serialKey = importKey(r.serial) ? `${r.restaurantId}/s/${importKey(r.serial)}` : null
    const first = seen.get(nameKey) ?? (serialKey ? seen.get(serialKey) : undefined)
    if (first) {
      twice.push({ row: r, first })
      continue
    }
    seen.set(nameKey, r)
    if (serialKey) seen.set(serialKey, r)
    const here = live.filter((e) => e.restaurant_id === r.restaurantId)
    const byName = here.find((e) => importKey(e.name) === importKey(r.name))
    const bySerial = serialKey ? here.find((e) => importKey(e.serial) === importKey(r.serial)) : undefined
    if (byName) matches.push({ row: r, existing: byName, by: 'name' })
    else if (bySerial) matches.push({ row: r, existing: bySerial, by: 'serial' })
  }
  return { matches, twice }
}
